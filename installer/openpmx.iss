; OpenPMX Windows Installer Script
; Built with Inno Setup

#define MyAppName "OpenPMX"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Dhirendra K. Sah"
#define MyAppURL "https://sahdhirendra.github.io/openpmx"
#define MyAppExeName "openpmx-launcher.bat"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\OpenPMX
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=installer\output
OutputBaseFilename=OpenPMX-Setup-v{#MyAppVersion}
SetupIconFile=icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "startupicon"; Description: "Start OpenPMX automatically with Windows"; GroupDescription: "Additional options:"

[Files]
Source: "..\dist\openpmx-backend.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\frontend\*"; DestDir: "{app}\frontend"; Flags: ignoreversion recursesubdirs
Source: "..\dist\config.yaml"; DestDir: "{app}"; Flags: ignoreversion
Source: "openpmx-launcher.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "nginx\*"; DestDir: "{app}\nginx"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\icon.ico"

[Registry]
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "OpenPMX"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "taskkill"; Parameters: "/F /IM openpmx-backend.exe"; Flags: runhidden

[Code]
procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel2.Caption := 
    'OpenPMX is a free, open-source predictive maintenance platform for manufacturers.' + #13#10 + #13#10 +
    'This will install OpenPMX v{#MyAppVersion} on your computer.' + #13#10 + #13#10 +
    'Click Next to continue.';
end;