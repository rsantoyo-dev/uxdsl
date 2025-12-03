import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('UXDSL extension is now active!');

    const provider = vscode.languages.registerCompletionItemProvider(
        'uxdsl',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const linePrefix = document.lineAt(position).text.substr(0, position.character);

                // Suggest directives if typing '@'
                if (linePrefix.endsWith('@')) {
                    return [
                        new vscode.CompletionItem('theme', vscode.CompletionItemKind.Keyword),
                        new vscode.CompletionItem('ds-surface', vscode.CompletionItemKind.Keyword),
                        new vscode.CompletionItem('ds-typo', vscode.CompletionItemKind.Keyword),
                        new vscode.CompletionItem('ds-button', vscode.CompletionItemKind.Keyword),
                    ];
                }

                // Suggest functions if inside a value (simplistic check)
                // We'll just provide them generally for now
                const functionCompletions = [
                    'palette', 'radius', 'density', 'shadow', 'space',
                    'xs', 'sm', 'md', 'lg', 'xl'
                ].map(fn => {
                    const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
                    item.insertText = new vscode.SnippetString(`${fn}($1)`);
                    return item;
                });

                return functionCompletions;
            }
        },
        '@' // Trigger character
    );

    context.subscriptions.push(provider);
}

export function deactivate() {}
