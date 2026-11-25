# Decisions

Each part's own decisions are in its `docs/decisions.md`; these are about the package.

- Four libraries became one package with subpath exports: they change together (a page plugin used two or three of them), one release replaces a cascade, and nobody outside used them on their own.
- One row and one browser module for both browser services: DSH gives a browser half only to a row named by a whole package, so `uiKit` and `uiActions` are started as two child plugins from one module. Their parts keep their own builds and tests, and a small script joins the two built modules.
- Consumers name `@soffits/dsh-plugin-sdk` in `dsh.client.inject`, which only orders module arrival; the services themselves are found by name, so a page that still names the old packages keeps working.
