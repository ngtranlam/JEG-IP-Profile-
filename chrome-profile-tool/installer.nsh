; NSIS Installer Script - Copy .env file to resources folder

!macro customInstall
  ; Copy .env file from installer to resources folder
  SetOutPath "$INSTDIR\resources"
  File "${BUILD_RESOURCES_DIR}\..\..\.env"
!macroend

!macro customUnInstall
  ; Remove .env file on uninstall
  Delete "$INSTDIR\resources\.env"
!macroend
