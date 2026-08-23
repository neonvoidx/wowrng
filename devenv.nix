{
  pkgs,
  lib,
  config,
  ...
}:

{
  languages = {
    javascript = {
      enable = true;
      yarn = {
        enable = true;
        install.enable = true;
      };
    };
    typescript.enable = true;
  };
}
