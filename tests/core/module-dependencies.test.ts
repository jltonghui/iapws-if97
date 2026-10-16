import ts from 'typescript';
import { expect, it } from 'vitest';

it('keeps runtime module dependencies acyclic', () => {
  const root = ts.sys.resolvePath('src');
  const files = ts.sys.readDirectory(root, ['.ts'], ['**/*.d.ts']);
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const source = ts.createSourceFile(file, ts.sys.readFile(file)!, ts.ScriptTarget.Latest, true);
    const dependencies: string[] = [];
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const module = statement.moduleSpecifier;
      if (module === undefined || !ts.isStringLiteral(module) || !module.text.startsWith('.')) continue;
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        if (clause?.isTypeOnly) continue;
        const bindings = clause?.namedBindings;
        if (clause?.name === undefined && bindings !== undefined && ts.isNamedImports(bindings) &&
            bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly)) continue;
      } else {
        if (statement.isTypeOnly) continue;
        const clause = statement.exportClause;
        if (clause !== undefined && ts.isNamedExports(clause) && clause.elements.length > 0 &&
            clause.elements.every((element) => element.isTypeOnly)) continue;
      }
      const resolved = ts.resolveModuleName(module.text, file, {
        module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      }, ts.sys).resolvedModule;
      expect(resolved, `Unresolved local module: ${module.text} from ${file}`).toBeDefined();
      dependencies.push(resolved!.resolvedFileName);
    }
    graph.set(file, dependencies);
  }

  const visited = new Set<string>();
  const path: string[] = [];
  const visit = (file: string): void => {
    const cycleStart = path.indexOf(file);
    expect(cycleStart, `Runtime dependency cycle: ${[...path.slice(cycleStart), file]
      .map((entry) => entry.slice(root.length + 1)).join(' -> ')}`).toBe(-1);
    if (visited.has(file)) return;
    expect(graph.has(file), `Unresolved local module: ${file.slice(root.length + 1)}`).toBe(true);
    path.push(file);
    for (const dependency of graph.get(file)!) visit(dependency);
    path.pop();
    visited.add(file);
  };
  for (const file of files) visit(file);
});
