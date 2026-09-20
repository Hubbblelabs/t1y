/// A small, closed arithmetic language for admin-defined calculators.
///
/// This is the Dart twin of `api/lib/utils/formula.ts`. The two implement the
/// same grammar and must stay in step: the server validates a formula when an
/// admin writes it, and this evaluates the same text on a phone, possibly
/// months later and with no connection. A formula the server accepted must
/// never mean something different here.
///
/// The app evaluates rather than asking the server to, because working out a
/// mealtime dose in a kitchen with no signal is the normal case for these
/// families, not an edge case.
///
/// ## The language
///
///   number        12, 3.5, .5 is rejected as malformed
///   variable      tdd, carbs, glucose
///   operators     + - * / ( ) and unary minus
///   functions     min(a, b), max(a, b), round(x), floor(x), ceil(x)
///
/// Nothing else parses. There is no string, no comparison, no assignment and
/// no property access, so a stored formula cannot express anything but
/// arithmetic.
library;

/// Raised when a formula cannot be parsed or cannot be worked out. The
/// message is written for a parent to read, not a developer.
class FormulaException implements Exception {
  final String message;

  FormulaException(this.message);

  @override
  String toString() => message;
}

enum _TokenType { number, identifier, operator, paren, comma }

class _Token {
  final _TokenType type;
  final String value;

  _Token(this.type, this.value);
}

/// Functions a formula may call, with their exact arity.
final Map<String, ({int arity, double Function(List<double>) apply})>
_functions = {
  'min': (arity: 2, apply: (args) => args[0] < args[1] ? args[0] : args[1]),
  'max': (arity: 2, apply: (args) => args[0] > args[1] ? args[0] : args[1]),
  'round': (arity: 1, apply: (args) => args[0].roundToDouble()),
  'floor': (arity: 1, apply: (args) => args[0].floorToDouble()),
  'ceil': (arity: 1, apply: (args) => args[0].ceilToDouble()),
};

const int _maxLength = 500;

final _whitespace = RegExp(r'\s');
final _digitOrDot = RegExp(r'[0-9.]');
final _identifierStart = RegExp(r'[A-Za-z_]');
final _identifierPart = RegExp(r'[A-Za-z0-9_]');

List<_Token> _tokenize(String source) {
  final tokens = <_Token>[];
  var i = 0;

  while (i < source.length) {
    final char = source[i];

    if (_whitespace.hasMatch(char)) {
      i++;
      continue;
    }

    if (_digitOrDot.hasMatch(char)) {
      final start = i;
      while (i < source.length && _digitOrDot.hasMatch(source[i])) {
        i++;
      }
      final value = source.substring(start, i);
      if ('.'.allMatches(value).length > 1 || value == '.') {
        throw FormulaException('"$value" is not a number.');
      }
      tokens.add(_Token(_TokenType.number, value));
      continue;
    }

    if (_identifierStart.hasMatch(char)) {
      final start = i;
      while (i < source.length && _identifierPart.hasMatch(source[i])) {
        i++;
      }
      tokens.add(_Token(_TokenType.identifier, source.substring(start, i)));
      continue;
    }

    if ('+-*/'.contains(char)) {
      tokens.add(_Token(_TokenType.operator, char));
      i++;
      continue;
    }

    if (char == '(' || char == ')') {
      tokens.add(_Token(_TokenType.paren, char));
      i++;
      continue;
    }

    if (char == ',') {
      tokens.add(_Token(_TokenType.comma, char));
      i++;
      continue;
    }

    throw FormulaException('"$char" cannot be used in a formula.');
  }

  return tokens;
}

/// Recursive-descent parser, matching the precedence in formula.ts:
///   expression := term (("+" | "-") term)*
///   term       := factor (("*" | "/") factor)*
///   factor     := ("-")? primary
///   primary    := number | identifier | call | "(" expression ")"
class _Parser {
  final List<_Token> _tokens;
  final Map<String, double> _variables;
  int _index = 0;

  _Parser(this._tokens, this._variables);

  _Token? _peek() => _index < _tokens.length ? _tokens[_index] : null;

  _Token? _next() => _index < _tokens.length ? _tokens[_index++] : null;

  double parse() {
    final value = _expression();
    final leftover = _peek();
    if (leftover != null) {
      throw FormulaException('Unexpected "${leftover.value}" in the formula.');
    }
    return value;
  }

  double _expression() {
    var value = _term();
    while (true) {
      final token = _peek();
      if (token == null ||
          token.type != _TokenType.operator ||
          (token.value != '+' && token.value != '-')) {
        break;
      }
      _next();
      final right = _term();
      value = token.value == '+' ? value + right : value - right;
    }
    return value;
  }

  double _term() {
    var value = _factor();
    while (true) {
      final token = _peek();
      if (token == null ||
          token.type != _TokenType.operator ||
          (token.value != '*' && token.value != '/')) {
        break;
      }
      _next();
      final right = _factor();
      if (token.value == '*') {
        value *= right;
      } else {
        // Matches formula.ts: a division by zero is refused outright rather
        // than producing infinity, so a parent never sees a nonsense dose.
        if (right == 0) {
          throw FormulaException('This works out as a division by zero.');
        }
        value /= right;
      }
    }
    return value;
  }

  double _factor() {
    final token = _peek();
    if (token != null &&
        token.type == _TokenType.operator &&
        token.value == '-') {
      _next();
      return -_factor();
    }
    if (token != null &&
        token.type == _TokenType.operator &&
        token.value == '+') {
      _next();
      return _factor();
    }
    return _primary();
  }

  double _primary() {
    final token = _next();
    if (token == null) throw FormulaException('The formula ends too early.');

    if (token.type == _TokenType.number) {
      final parsed = double.tryParse(token.value);
      if (parsed == null) {
        throw FormulaException('"${token.value}" is not a number.');
      }
      return parsed;
    }

    if (token.type == _TokenType.identifier) {
      final fn = _functions[token.value];
      if (fn != null) return _call(token.value, fn);

      final value = _variables[token.value];
      if (value == null) {
        throw FormulaException('No value was given for "${token.value}".');
      }
      if (!value.isFinite) {
        throw FormulaException(
          'The value for "${token.value}" is not a number.',
        );
      }
      return value;
    }

    if (token.type == _TokenType.paren && token.value == '(') {
      final value = _expression();
      final closing = _next();
      if (closing?.value != ')') {
        throw FormulaException('A bracket is not closed.');
      }
      return value;
    }

    throw FormulaException('Unexpected "${token.value}" in the formula.');
  }

  double _call(
    String name,
    ({int arity, double Function(List<double>) apply}) fn,
  ) {
    final open = _next();
    if (open?.value != '(') {
      throw FormulaException('"$name" must be followed by a bracket.');
    }

    final args = <double>[];
    if (_peek()?.value == ')') {
      _next();
    } else {
      while (true) {
        args.add(_expression());
        final separator = _next();
        if (separator?.value == ')') break;
        if (separator?.value != ',') {
          throw FormulaException('"$name" is missing a bracket.');
        }
      }
    }

    if (args.length != fn.arity) {
      throw FormulaException(
        '"$name" needs ${fn.arity} number${fn.arity == 1 ? '' : 's'}, not ${args.length}.',
      );
    }
    return fn.apply(args);
  }
}

/// Works out [expression] using [variables].
///
/// Throws [FormulaException] with a message suitable for showing directly.
double evaluateFormula(String expression, Map<String, double> variables) {
  if (expression.length > _maxLength) {
    throw FormulaException(
      'A formula cannot be longer than $_maxLength characters.',
    );
  }

  final result = _Parser(_tokenize(expression), variables).parse();

  if (!result.isFinite) {
    throw FormulaException(
      'This formula does not work out to a usable number.',
    );
  }
  return result;
}
