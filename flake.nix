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

            # Lint + format (the npm dep is also present; this makes `biome` work in shells without a node_modules)
            biome
          ];

          shellHook = ''
            echo "Swiss-Function dev shell"
            echo "  node $(node --version)"
            echo "  npm  $(npm --version)"
            echo "  tsc  $(tsc --version)"
          '';
        };
      }
    );
}
