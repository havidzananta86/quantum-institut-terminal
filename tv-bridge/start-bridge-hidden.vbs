' Menjalankan start-bridge.cmd tanpa jendela konsol.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.Run Chr(34) & fso.GetParentFolderName(WScript.ScriptFullName) & "\start-bridge.cmd" & Chr(34), 0, False
