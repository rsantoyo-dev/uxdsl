// Minimal shims to compile without @types/node.
declare module 'fs' { const anyFs: any; export = anyFs; }
declare module 'path' { const anyPath: any; export = anyPath; }
declare var require: any;
declare var __dirname: string;
declare var process: any;
// MIG-B6-21: base64-encoding the inline sourcemap data URI.
declare var Buffer: { from(input: string, encoding: string): { toString(encoding: string): string } };

