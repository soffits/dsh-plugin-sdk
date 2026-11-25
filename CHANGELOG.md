# Changelog

## 0.2.0

- `buildClient` takes an `id`, for a part of a package that has no `package.json` of its own; the header then names that id.

## 0.1.0

- First release: @soffits/dsh-host-kit, @soffits/dsh-channel-core, @soffits/dsh-ui-kit and @soffits/dsh-ui-actions in one package. Host helpers at `@soffits/dsh-plugin-sdk/host` (`/host/build`), chat bridge helpers at `/channel` (`/channel/testing`), the item format at `/actions/item`; one row `plugin-sdk` whose browser half provides `ctx.uiKit` and `ctx.uiActions` as before.
