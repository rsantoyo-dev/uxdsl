import * as vscode from 'vscode';
import { completions } from './generated-completions';
import { getCompletionContext } from './completion-context';

function functionCompletionItems(): vscode.CompletionItem[] {
    return completions.functions.map(fn => {
        const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
        item.insertText = new vscode.SnippetString(`${fn}($1)`);
        return item;
    });
}

function directiveCompletionItems(): vscode.CompletionItem[] {
    return completions.directives.map(name => new vscode.CompletionItem(`@${name}`, vscode.CompletionItemKind.Keyword));
}

interface DirectiveArgumentMeta {
    roles: readonly string[];
    tones: readonly string[];
    sizes: readonly string[];
    overrides: readonly string[];
}

// MIG-B6-26 (FEAT-008): `directiveArguments` keys are typed as a fixed
// union (`ds-surface` | `ds-button` | `ds-input`) by `as const`, but
// `getCompletionContext` reports whatever directive name it found in the
// text — including one this extension has no argument metadata for
// (`ds-typo` takes no arguments at all; a typo'd directive matches
// neither). Looked up defensively instead of asserting the type.
function directiveArgumentCompletionItems(directive: string): vscode.CompletionItem[] {
    const meta = (completions.directiveArguments as Record<string, DirectiveArgumentMeta | undefined>)[directive];
    if (!meta) return [];
    const items: vscode.CompletionItem[] = [];
    for (const role of meta.roles) {
        items.push(new vscode.CompletionItem(role, vscode.CompletionItemKind.EnumMember));
    }
    for (const tone of meta.tones) {
        const item = new vscode.CompletionItem(tone, vscode.CompletionItemKind.Color);
        item.detail = 'Palette tone (main/dark/contrast family)';
        items.push(item);
    }
    for (const size of meta.sizes) {
        const item = new vscode.CompletionItem(size, vscode.CompletionItemKind.Value);
        item.detail = 'Density/Radius size';
        items.push(item);
    }
    for (const fn of meta.overrides) {
        const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
        item.insertText = new vscode.SnippetString(`${fn}(\${1:key})`);
        item.detail = 'Configured token override; preserves the other role fields';
        items.push(item);
    }
    return items;
}

export function activate(context: vscode.ExtensionContext) {
    const provider = vscode.languages.registerCompletionItemProvider(
        'uxdsl',
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                // MIG-B6-26 (FEAT-008): the full document up to the cursor,
                // not just the current line — a block comment or a
                // declaration's value can start on an earlier line, and
                // getCompletionContext needs that to tell "inside a
                // comment"/"inside a value" apart from "inside a selector".
                const textBeforeCursor = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
                const ctx = getCompletionContext(textBeforeCursor);
                switch (ctx.kind) {
                    case 'directive-arguments':
                        return directiveArgumentCompletionItems(ctx.directive);
                    case 'directive':
                        return directiveCompletionItems();
                    case 'value':
                        return functionCompletionItems();
                    case 'none':
                    default:
                        return [];
                }
            }
        },
        // MIG-B6-26 (FEAT-008): ' ' removed — it fired completion on every
        // space, including inside a selector where nothing should be
        // offered at all (getCompletionContext still gates what's actually
        // returned, but a trigger character also controls when VS Code
        // proactively opens the suggestion widget without the user asking).
        '@', '('
    );

    context.subscriptions.push(provider);
}

export function deactivate() {}
