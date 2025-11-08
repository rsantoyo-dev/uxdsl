// Minimal shims to compile without @types/node.
declare module 'fs' { const anyFs: any; export = anyFs; }
declare module 'path' { const anyPath: any; export = anyPath; }
declare var require: any;
declare var __dirname: string;
declare var process: any;

