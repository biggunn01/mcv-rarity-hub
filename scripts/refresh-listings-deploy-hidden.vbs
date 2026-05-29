Set shell = CreateObject("WScript.Shell")
repo = "C:\Users\HENRI\.openclaw\workspace\projects\mcv-rarity-hub"
script = repo & "\scripts\refresh-listings-deploy.ps1"
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & Chr(34) & script & Chr(34)
shell.CurrentDirectory = repo
shell.Run cmd, 0, True
