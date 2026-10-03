# Zotero PDF/EPUB/HTML reader and annotator

## Build

Clone the repository:

```
git clone https://github.com/zotero/reader --recursive
```

With Node 18+, run the following:

```
NODE_OPTIONS=--openssl-legacy-provider npm i
NODE_OPTIONS=--openssl-legacy-provider npm run build
```

This will produce `dev`, `web` and `zotero` builds in the `build/` directory.

## Development

Run `npm start` and open http://localhost:3000/dev/reader.html.



### Annotation profile configuration (Obsidian host)

`initReader` accepts an optional `annotationProfileConfig`:

```js
{
    profiles: [{
        id: "research",
        name: "Research",
        palette: [{ id: "method", color: "#ffd400", label: "Methodology" }]
    }],
    activeProfileId: "research",
    autoTag: false
}
```

The host validates nonempty palettes and distinct normalized hex colors before
sending configuration. The reader copies it into instance state. Missing
configuration preserves the original Zotero palette and tool defaults.
`setAnnotationProfileConfig(config)` updates it without changing annotations;
`annotationProfileChanged` emits `{ profileId }` when the user chooses a profile.
The host owns settings persistence and reconnect replay.

Menus, selection popups, keyboard shortcuts and sidebar color filters use the
instance palette. Ink/text retain extra black. A removed tool color falls back
to the first available color; existing annotations retain their colors and tags.
With `autoTag`, genuinely new interactive annotations receive the chosen entry's
label as an ordinary tag before history/debounced save. Refresh, import, edit,
undo/redo and structural recreation do not apply creation defaults. Labels and
profile IDs are never added to serialized annotations.

Run `npm test` for palette isolation, creation-time tagging, undo/redo and native
selector keyboard regression checks. The ZotFlow host has a local-only live test
at `tests/live/annotation-profiles.live.mjs` for the coordinated API and UI.
