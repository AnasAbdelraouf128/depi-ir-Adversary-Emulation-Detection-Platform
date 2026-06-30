[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
$token = (Invoke-RestMethod -Method Post -Uri "https://54.83.241.104:55000/security/user/authenticate?raw=true" -Headers @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("wazuh-wui:Eyq8k3dx0Gl2Y4aUFUO*VXSLBoSlXGuh")) })
$agents = Invoke-RestMethod -Method Get -Uri "https://54.83.241.104:55000/agents?pretty=true" -Headers @{ Authorization = "Bearer $token" }
$agents | ConvertTo-Json -Depth 5
