{
  description = "Dev environment for nodejs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };


      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            python3
            yarn
            cypress
            python312Packages.distutils
          ];

          shellHook = ''
            echo "🚀 Dev shell ready: Node.js"
            echo "Node: ${pkgs.nodejs_22.version}"
            export CYPRESS_INSTALL_BINARY=0
            export CYPRESS_RUN_BINARY=${pkgs.cypress}/bin/Cypress
            export CHROME_BIN=${pkgs.chromium}/bin/chromium
            code .
          '';
        };
      });
}
