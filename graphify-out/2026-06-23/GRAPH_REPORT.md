# Graph Report - .  (2026-06-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 68 nodes · 79 edges · 8 communities (5 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e6d07f7e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 13 edges
2. `ProjectsService` - 8 edges
3. `ProjectsController` - 6 edges
4. `CreateProjectDto` - 5 edges
5. `scripts` - 4 edges
6. `Project` - 4 edges
7. `AppModule` - 2 edges
8. `ProjectsModule` - 2 edges
9. `private` - 1 edges
10. `dev` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (8 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.22
Nodes (4): CreateProjectDto, Project, ProjectsController, ProjectsService

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (15): compilerOptions, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, lib, module, moduleResolution, outDir (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (14): dependencies, bullmq, class-transformer, class-validator, ioredis, @nestjs/common, @nestjs/core, @nestjs/platform-express (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.25
Nodes (7): name, private, scripts, build, dev, start, version

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (6): devDependencies, @nestjs/cli, @nestjs/schematics, ts-node-dev, @types/node, typescript

## Knowledge Gaps
- **40 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 2` to `Community 3`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 4` to `Community 3`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._