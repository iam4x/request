# Contributing to @iam4x/request

Thank you for your interest in contributing to @iam4x/request! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Environment details (Node.js version, OS, etc.)
- Code examples or error messages if applicable

### Suggesting Features

Feature suggestions are welcome! Please open an issue with:

- A clear description of the feature
- Use cases and examples
- Potential implementation approach (if you have ideas)

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following the project's coding standards
3. **Add tests** for any new functionality or bug fixes
4. **Ensure all tests pass** (`bun test`)
5. **Run linting** (`bun run lint`)
6. **Update documentation** if needed
7. **Commit your changes** with clear, descriptive commit messages
8. **Push to your fork** and open a Pull Request

### Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/your-username/request.git
   cd request
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Run tests:
   ```bash
   bun test
   ```

4. Run linting:
   ```bash
   bun run lint
   ```

5. Build the project:
   ```bash
   bun run build
   ```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide type annotations for function parameters and return types
- Use meaningful variable and function names
- Follow existing code style and patterns

### Testing

- Write tests for all new features and bug fixes
- Use descriptive test names
- Follow the existing test structure using Bun's test framework
- Aim for good test coverage

### Code Style

- Use consistent formatting (Prettier is configured)
- Follow ESLint rules
- Keep functions focused and small
- Add comments for complex logic

### Commit Messages

Use clear, descriptive commit messages:

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Fix bug" not "Fixes bug")
- Keep the first line under 72 characters
- Reference issues when applicable: "Fix #123"

Examples:
```
Add support for PATCH method
Fix query string encoding for special characters
Update README with new examples
```

## Project Structure

```
src/
  ├── index.ts              # Main entry point
  ├── index.test.ts         # Main tests
  └── utils/
      ├── query-string.utils.ts
      ├── query-string.utils.test.ts
      ├── retry.utils.ts
      ├── retry.utils.test.ts
      ├── omit-undefined.utils.ts
      └── omit-undefined.utils.test.ts
```

## Review Process

1. All pull requests will be reviewed
2. Maintainers may request changes
3. Once approved, your PR will be merged
4. Thank you for your contribution!

## Questions?

If you have questions about contributing, please open an issue with the `question` label.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

