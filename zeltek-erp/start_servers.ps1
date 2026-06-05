$ErrorActionPreference = "Continue"

Write-Host "=== PREPARANDO BACKEND ===" -ForegroundColor Cyan
cd "c:\Users\Denzel\Desktop\ERP\zeltek-erp\backend"
npm install

Write-Host "=== CONFIGURANDO BASE DE DATOS ===" -ForegroundColor Cyan
# Ejecutamos db push aceptando pérdida de datos localmente si la hubiera para que no se pause pidiendo input
npx prisma db push --accept-data-loss
npm run db:seed

Write-Host "=== INICIANDO BACKEND ===" -ForegroundColor Green
# Abre una nueva ventana de terminal para el backend
Start-Process powershell -ArgumentList "-NoExit -Title `"ZELTEK ERP - Backend`" -Command `"cd c:\Users\Denzel\Desktop\ERP\zeltek-erp\backend; npm run dev`""

Write-Host "=== PREPARANDO FRONTEND ===" -ForegroundColor Cyan
cd "c:\Users\Denzel\Desktop\ERP\zeltek-erp\frontend"
npm install

Write-Host "=== INICIANDO FRONTEND ===" -ForegroundColor Green
# Abre una nueva ventana de terminal para el frontend
Start-Process powershell -ArgumentList "-NoExit -Title `"ZELTEK ERP - Frontend`" -Command `"cd c:\Users\Denzel\Desktop\ERP\zeltek-erp\frontend; npm run dev`""

Write-Host "=== TODO LISTO ===" -ForegroundColor Green
Write-Host "Abre http://localhost:5173 en tu navegador para probar."
