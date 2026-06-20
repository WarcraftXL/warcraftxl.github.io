# warcraftxl.github.io

The WarcraftXL website: home, the build wiki, and a live module catalog.

Static site - plain HTML, CSS and JavaScript, no build step. Tailwind, AOS, lucide and highlight.js
are pulled from CDNs; the catalog reads the GitHub organization's repositories at runtime.

## Pages

- `index.html` - home.
- `docs.html` - the wiki: requirements, building, installing, and writing a module.
- `catalog.html` - browse modules, discovered live from the [WarcraftXL](https://github.com/WarcraftXL) org and filterable by topic.

## Local preview

Any static file server works, for example:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

## How the catalog finds modules

It lists the organization's repositories and keeps those named `wxl-*` or tagged with a `wxl-*` topic.
Tag a repository with a topic such as `wxl-module` or `wxl-script` for it to show up, and to appear under
that topic's filter.

## License

Released under the GNU General Public License v3.0.

*Thanks Claude for this.*