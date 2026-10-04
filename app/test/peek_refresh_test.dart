import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:t1dpe/widgets/peek_refresh.dart';

Widget _app(Future<void> Function() onRefresh) => MaterialApp(
  home: Scaffold(
    body: PeekRefresh(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        children: [for (var i = 0; i < 30; i++) ListTile(title: Text('row $i'))],
      ),
    ),
  ),
);

void main() {
  testWidgets('a long pull down refreshes once', (tester) async {
    var calls = 0;
    await tester.pumpWidget(_app(() async => calls++));

    await tester.drag(find.byType(ListView), const Offset(0, 400));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1500));
    await tester.pumpAndSettle();

    expect(calls, 1);
  });

  testWidgets('a short pull does not refresh', (tester) async {
    var calls = 0;
    await tester.pumpWidget(_app(() async => calls++));

    await tester.drag(find.byType(ListView), const Offset(0, 40));
    await tester.pumpAndSettle();

    expect(calls, 0);
  });
}
