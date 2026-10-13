# UMN browser-testing

Campus route assertions/fixtures over the exact public shared browser helper.

Independent sibling repository. Prepared public releases do not require the private backup. Source extraction and checks are queued; see [owner instructions](AGENTS.md).

The public entry exports Campus content, route, tab, report and update assertions
plus runners using the pinned shared browser helper. The
[qualification guide](docs/qualification.md) describes required compiled seals,
actual observation ports, finite timeouts and retained evidence. The selector's
JavaScript-disabled Chrome fixture is independent of App and Scenes inputs.
Full four-route qualification still needs qualified native, content and worker
deliveries. Browser fixtures reject source plans; no passing result is claimed.

`npm test` and `npm run check:source` are prepared for a granted CPU check scope.
Actual browsers and fixture servers require their own explicit grant and measured
compiled candidate. The helper is used through `/page` and `/chrome` public exports.

- [Code of conduct](https://github.com/UMN-VR/.github/blob/main/CODE_OF_CONDUCT.md)
- [Contributing](https://github.com/UMN-VR/.github/blob/main/CONTRIBUTING.md)
- [AGPL-3.0 license](LICENSE)
- [Security](https://github.com/UMN-VR/.github/blob/main/SECURITY.md)
