# UMG Studio v0.1 Architecture Summary

UMG Studio v0.1 is a local-first React + TypeScript workbench for composing, inspecting, compiling, tracing, and exporting UMG sleeves. It is intentionally a front-end/orchestration layer around existing UMG assets rather than a replacement for the UMG compiler or block library.

## Architecture at a glance

```text
UMG-Block-Library / sample JSON
        ↓
Migration + normalization layer
        ↓
Studio normalized catalog
        ↓
Composer: request → draft Sleeve
        ↓
Workspace graph: Sleeve → NeoStack → NeoBlock → MOLT Block
        ↓
Compiler bridge
        ↓
RuntimeSpec + Trace + Prompt Preview + IR Matrix
        ↓
Hermes packet export / optional Hermes generation
```

## Upstream UMG-Block-Library source

The upstream block library is treated as source material for the Studio catalog. v0.1 imports library-like JSON assets and normalizes them into the Studio data model.

Important behavior:

- Upstream/source assets remain distinct from workspace copies.
- Imported assets can preserve source/legacy metadata.
- Human-readable references can be skipped or treated as reference-only depending on migration output.
- Unsupported future roles are not activated in v0.1.

The active v0.1 MOLT role set is:

- `trigger`
- `directive`
- `instruction`
- `subject`
- `primary`
- `philosophy`
- `blueprint`

`aim`, `use`, and `need` remain future roles and are not active compiler roles in v0.1.

## Normalized Studio catalog

The normalized catalog is the Studio-facing block library. It provides consistent fields for browsing, filtering, composition, graph display, compile conversion, and export.

A normalized MOLT block includes fields such as:

- `id`
- `title`
- `type`
- `role`
- `content`
- `category`
- `tags`
- `priorityOrder`
- `defaultState`
- `visibility`
- `activation`
- `dependencies`
- `conflicts`
- `source`
- optional `legacy` metadata

This normalized layer allows messy or incomplete upstream assets to be displayed safely without losing source context.

## Workspace model

The workspace holds active user composition state:

```text
Workspace
  Sleeve
    NeoStack
      NeoBlock
        MOLT Block
```

The workspace also tracks graph state, selected/focused nodes, runtime session artifacts, and manual layout metadata.

Library assets and workspace copies are separate. Editing or toggling a workspace copy should not mutate the source library asset unless explicit sync behavior is added later.

## Composer

The v0.1 composer is deterministic and tag/role based. It accepts a plain-language request and creates a draft Sleeve using relevant blocks from the normalized catalog.

The composer is designed to prove the workflow:

```text
request → selected blocks → draft sleeve → graph → compile → runtime/export
```

It is not a full autonomous planner, marketplace selector, vector database, or cloud agent runtime.

## Graph hierarchy views

The graph layer translates the active workspace into hierarchy-specific views.

### Full Sleeve View

Purpose: top-level architecture.

Shows:

- Sleeve node
- NeoStack nodes
- high-level connector lines

Connector lines are allowed here because this view represents high-level architecture relationships.

### NeoStack View

Purpose: inspect one stack.

Shows:

- selected NeoStack
- its NeoBlocks

NeoBlocks are attached/tiled rather than line-connected. If relationships are needed, v0.1 prefers layout, badges, or grouping over random internal connector lines.

### NeoBlock View

Purpose: inspect one block bundle.

Shows:

- selected NeoBlock
- contained MOLT blocks

MOLT cards are attached/tiled and preserve runtime state visuals.

### MOLT Block View

Purpose: inspect one atomic block.

Shows:

- one selected MOLT block
- Inspector metadata
- normalized JSON
- source/legacy data when present
- runtime state
- IR Matrix row when available

No connector lines are shown in this view.

## Layout metadata

Graph nodes support layout metadata so UMG structure can carry visual meaning.

Layout metadata can include:

- `x` / `y` position
- `row` / `column` position
- `width` / `height`
- `span`
- `priorityRank`
- `relation`
- `manual` override flag

Supported relation values:

- `governs`
- `parallel`
- `supports`
- `fallback`
- `sequence`
- `contains`

Interpretation:

- Higher/top cards represent governing or priority roles.
- Side-by-side cards represent parallel/equal-status functions.
- Lower cards represent subordinate, execution, or support roles.

Manual movement stores layout overrides on the workspace graph node without clearing runtime state.

## Real umg-compiler bridge

UMG Studio does not replace the compiler.

The compiler bridge adapts the active workspace/Sleeve into the local compiler's expected input shape and calls the local compiler from:

```text
/home/neomagnetar/umg-compiler/compiler-v0/dist/compile.js
```

The bridge converts the Studio hierarchy into compiler-oriented structures:

- active Sleeve
- active stacks
- active blocks
- MOLT role fields
- priority/order data
- tags

Expected real compile output is normalized back into Studio artifacts:

- RuntimeSpec
- Trace
- Diagnostics
- prompt preview
- IR Matrix

When real compiler execution succeeds, RuntimeSpec includes:

```json
{
  "compiler": "umg-compiler",
  "source": "real"
}
```

## Deterministic fallback

The deterministic fallback remains part of the compiler bridge.

Fallback exists to keep local compile-only inspection available if the real compiler bridge is unavailable or throws. It is not a replacement for the real compiler path; it is a resilience path for local development and UI testing.

Fallback output still includes:

- RuntimeSpec-like object
- Trace-like rows
- Diagnostics
- prompt preview
- IR Matrix

The fallback must not be removed for v0.1.

## Runtime graph mapping

After compile, Studio maps runtime artifacts back onto graph nodes.

Runtime node state includes:

- active
- off
- triggered
- warning
- invalid
- selected/focused

The graph uses these states visually:

- active nodes glow
- off nodes are greyed and low opacity
- triggered nodes can show triggered state
- warning/invalid nodes show warning/error styling

Hierarchy focus changes must not erase runtime state. Manual layout changes must not erase runtime state.

## IR Matrix

The IR Matrix is the tabular runtime/audit view for graph agreement.

Each row can include:

- row ID
- node ID
- node type
- role
- title
- selected
- active
- off
- triggered
- gate passed
- required
- matched tags
- relevance score
- priority
- contribution
- warning

The graph and IR Matrix should agree after compile. If a block is off in the graph, the corresponding IR Matrix row should show off state. If a block is active in runtime, the graph should show active visual state.

## Hermes config and export layer

Hermes is optional for v0.1 validation.

Studio supports local Hermes configuration through the Inspector / Config surface. The config layer is separated from export behavior so secrets do not leak.

Safety rules:

- API keys are not exported in workspace JSON.
- API keys are not exported in Hermes packets.
- The Hermes packet must not include an `apiKey` field.
- UI display should redact any local key value.
- If Hermes is not configured, generation should be blocked or clearly warned.
- Compile/export should still work without Hermes.

A Hermes packet can include:

- mode
- user request
- compiled prompt
- RuntimeSpec
- Trace
- IR Matrix
- active blocks
- safe settings such as model/temperature/max tokens

## Local-first release posture

UMG Studio v0.1 is a local workbench and demoable prototype.

It does not include:

- cloud sync
- account system
- payment system
- marketplace
- multi-user collaboration
- deployment pipeline
- full autonomous multi-agent orchestration
- full website builder

The v0.1 release goal is narrower:

```text
Describe the task.
Compose UMG blocks.
Inspect the graph hierarchy.
Compile the structure.
Review runtime artifacts.
Export a Hermes-safe packet.
```

## Key source files

```text
src/App.tsx                         UI shell, workbench, graph controls, inspector/config
src/style.css                       workbench/graph/runtime visual styling
src/lib/umg/types.ts                Studio data model and layout metadata
src/lib/umg/migrateLibrary.ts       source asset normalization
src/lib/umg/composeBlocks.ts        deterministic/tag-based composer
src/lib/umg/graphBuilder.ts         graph construction, focus views, runtime mapping
src/lib/umg/compilerBridge.ts       real compiler adapter + deterministic fallback
src/lib/umg/irMatrix.ts             IR Matrix helpers
src/lib/umg/exporters.ts            workspace/Hermes-safe exports
src/lib/umg/workbenchLayout.ts      panel layout persistence
src/lib/hermes/hermesClient.ts      Hermes test/generate wrapper
src/test/umg-core.test.ts           core workflow and regression tests
```
