Set WshShell = CreateObject("WScript.Shell")
' Inicia el servidor de Encuentro Juvenil en segundo plano (0 = ventana invisible)
WshShell.Run "cmd /c npm start", 0, False
WScript.Echo "✅ El servidor Encuentro Juvenil está corriendo en segundo plano sin terminal abierta."
