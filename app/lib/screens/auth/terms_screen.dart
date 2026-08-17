import 'package:flutter/material.dart';

import '../../models/terms_content.dart';
import '../../theme/app_theme.dart';

/// Full text behind the chat's "Read more" link.
class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Terms & Conditions'),
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.deep,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Text(
            termsFullText.trim(),
            style: const TextStyle(
              color: Colors.black,
              fontSize: 14,
              height: 1.6,
            ),
          ),
        ),
      ),
    );
  }
}
