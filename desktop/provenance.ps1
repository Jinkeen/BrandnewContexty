param([long]$WindowHandle = 0)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ActiveWindowInfo {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr handle, StringBuilder text, int length);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
}
'@

$handle = if ($WindowHandle) { [IntPtr]::new($WindowHandle) } else { [ActiveWindowInfo]::GetForegroundWindow() }
$titleBuffer = [System.Text.StringBuilder]::new(512)
[void][ActiveWindowInfo]::GetWindowText($handle, $titleBuffer, $titleBuffer.Capacity)
$processId = [uint32]0
[void][ActiveWindowInfo]::GetWindowThreadProcessId($handle, [ref]$processId)
$processName = try { (Get-Process -Id $processId -ErrorAction Stop).ProcessName } catch { '' }
$appName = switch ($processName.ToLowerInvariant()) {
  'chrome' { 'Google Chrome' }
  'msedge' { 'Microsoft Edge' }
  'firefox' { 'Mozilla Firefox' }
  'brave' { 'Brave' }
  'electron' { 'Brandnew Contexty' }
  default { if ($processName) { $processName } else { '当前应用' } }
}

$url = ''
if ($processName -in @('chrome', 'msedge', 'brave', 'firefox')) {
  try {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
    $condition = [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Edit
    )
    $edits = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    foreach ($edit in $edits) {
      $name = $edit.Current.Name
      if ($name -notmatch 'address|search|地址|搜索|アドレス') { continue }
      $pattern = $null
      if (-not $edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) { continue }
      $candidate = $pattern.Current.Value.Trim()
      if ($candidate -match '^(https?://|file://|chrome://|edge://|about:)' ) { $url = $candidate; break }
      if ($candidate -match '^[^\s/]+\.[^\s/]+(?:/\S*)?$') { $url = 'https://' + $candidate; break }
    }
  } catch { }
}

$json = [pscustomobject]@{
  source = $appName
  sourceTitle = $titleBuffer.ToString()
  sourceUrl = $url
} | ConvertTo-Json -Compress
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
