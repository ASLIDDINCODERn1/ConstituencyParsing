' O'zbek Dependency Parser — Launcher
' launch.vbs ni ikki marta bosish yetarli

Dim objShell, strDir
Set objShell = CreateObject("WScript.Shell")

' Ushbu faylning joylashgan papkasi
strDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
objShell.CurrentDirectory = strDir

' py launcher (eng ishonchli), yo'q bo'lsa python
Dim objFSO
Set objFSO = CreateObject("Scripting.FileSystemObject")

Dim bFound : bFound = False

' py launcher bor mi?
On Error Resume Next
Dim objExec
Set objExec = objShell.Exec("py --version")
If Err.Number = 0 Then
    objShell.Run "py run.py", 1, False
    bFound = True
End If
Err.Clear
On Error GoTo 0

' py yo'q bo'lsa python sinash
If Not bFound Then
    On Error Resume Next
    Set objExec = objShell.Exec("python --version")
    If Err.Number = 0 Then
        objShell.Run "python run.py", 1, False
        bFound = True
    End If
    Err.Clear
    On Error GoTo 0
End If

' Topilmadi
If Not bFound Then
    MsgBox "Python topilmadi!" & vbCrLf & vbCrLf & _
           "https://python.org dan Python 3.11+ yuklab o'rnating." & vbCrLf & _
           "O'rnatayotganda 'Add Python to PATH' ni belgilang.", _
           vbCritical, "O'zbek Dependency Parser"
End If
