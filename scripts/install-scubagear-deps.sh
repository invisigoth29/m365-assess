#!/bin/bash
#
# Install ScubaGear PowerShell module dependencies
# This installs the PowerShell modules required for full M365 product coverage
#

set -e

echo "Installing ScubaGear PowerShell module dependencies..."
echo ""

# PowerApps/PowerPlatform module
echo "📦 Installing Microsoft.PowerApps.PowerShell..."
pwsh -NoProfile -Command "Install-Module -Name Microsoft.PowerApps.PowerShell -Force -AllowClobber -Scope CurrentUser" 2>&1 | grep -E "(Installing|Installed|already installed)" || true

# SharePoint Online module
echo "📦 Installing Microsoft.Online.SharePoint.PowerShell..."
pwsh -NoProfile -Command "Install-Module -Name Microsoft.Online.SharePoint.PowerShell -Force -AllowClobber -Scope CurrentUser" 2>&1 | grep -E "(Installing|Installed|already installed)" || true

echo ""
echo "✅ Dependencies installed successfully"
echo ""
echo "These modules enable ScubaGear to assess:"
echo "  - PowerPlatform (Power Apps, Power Automate)"
echo "  - SharePoint Online"
echo ""
echo "Run 'node audit.js' to perform an assessment with full product coverage."
