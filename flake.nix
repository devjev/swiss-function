{
  description = "Swiss-Function — design system dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Runtime — Node 26 (latest "Current" as of June 2026; Node 25 was EOL'd 2026-06-01 and dropped from nixpkgs)
            nodejs_26

            # TypeScript + JS LSPs
            typescript
            typescript-language-server

            # HTML / CSS / JSON LSPs (CSS Modules autocompletion, package.json schema, etc.)
            vscode-langservers-extracted

            # Lint + format (used directly; not bundled via npm — npm's prebuilt binary
            # doesn't run on NixOS without patching)
            biome

            # Playwright browsers — patched for NixOS. The npm `playwright` package
            # can't install browsers on NixOS (needs sudo + Ubuntu-style libs);
            # we set PLAYWRIGHT_BROWSERS_PATH below so Playwright finds these.
            playwright-driver.browsers
          ];

          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            # Keep host browsers (already patched); don't try to validate npm-installed ones.
            export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1

            echo "Swiss-Function dev shell"
            echo "  node             $(node --version)"
            echo "  npm              $(npm --version)"
            echo "  tsc              $(tsc --version)"
            echo "  playwright-nix   ${pkgs.playwright-driver.browsers.version or "?"}"
          '';
        };
      }
    );
}
