# Troubleshooting Guide

## Common Issues & Solutions

### Installation Issues

#### Problem: `npm install` fails
**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

#### Problem: Node version incompatibility
**Solution:**
```bash
# Check Node version (need 18+)
node --version

# If too old, install nvm and update
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Backend Issues

#### Problem: Port 3001 already in use
**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use different port in backend/src/main.ts
await app.listen(3002);
```

#### Problem: TypeScript compilation errors
**Solution:**
```bash
# Install TypeScript globally
npm install -g typescript

# Or use npx
npx ts-node src/main.ts
```

#### Problem: Module not found errors
**Solution:**
```bash
# Ensure all dependencies are installed
cd backend
npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/platform-socket.io @nestjs/websockets reflect-metadata rxjs socket.io

# Check tsconfig.json exists
```

### Frontend Issues

#### Problem: Port 3000 already in use
**Solution:**
```bash
# Kill process on port 3000
lsof -i :3000
kill -9 <PID>

# Or set different port
PORT=3001 npm start
```

#### Problem: Leaflet CSS not loading
**Symptoms:** Map appears broken, no tiles

**Solution:**
```bash
# Ensure leaflet is installed
npm install leaflet react-leaflet @types/leaflet

# Check public/index.html has CSS link
# <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

#### Problem: WebSocket connection fails
**Symptoms:** No vehicles appear, console shows connection errors

**Solution:**
1. Check backend is running on port 3001
2. Check CORS is enabled in backend
3. Verify WebSocket URL in App.tsx: `io('http://localhost:3001')`
4. Check browser console for errors

### Runtime Issues

#### Problem: No vehicles showing on map
**Debug steps:**
```javascript
// In browser console:
// 1. Check if vehicles loaded
console.log('Vehicles:', vehicles);

// 2. Check WebSocket connection
// Look for: "WebSocket connection established"

// 3. Check for JavaScript errors
// Open DevTools Console tab
```

**Solutions:**
- Ensure backend is running and generating events
- Check browser console for errors
- Verify WebSocket connection in Network tab
- Check if filters are hiding all vehicles

#### Problem: Map not rendering
**Solutions:**
```bash
# Reinstall Leaflet
npm uninstall leaflet react-leaflet
npm install leaflet@1.9.4 react-leaflet@4.2.1

# Clear browser cache
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

#### Problem: Vehicles not moving
**Check:**
1. Backend console - should show event generation logs
2. Browser DevTools Network tab - WebSocket should show messages
3. EventGenerator is running (check backend/src/vehicle.gateway.ts)

**Solution:**
- Restart backend
- Check EventGenerator.generateEvents() is called
- Verify setInterval is working

#### Problem: High CPU usage
**Cause:** Too many updates or render cycles

**Solution:**
```typescript
// In App.tsx, throttle updates:
const [lastUpdate, setLastUpdate] = useState(Date.now());

socket.on('vehicle-update', (vehicle: Vehicle) => {
  const now = Date.now();
  if (now - lastUpdate > 100) { // Max 10 updates/sec
    setVehicles(prev => {
      const updated = new Map(prev);
      updated.set(vehicle.id, vehicle);
      return updated;
    });
    setLastUpdate(now);
  }
});
```

### Browser Issues

#### Problem: Map tiles not loading
**Symptoms:** Gray squares instead of map

**Solutions:**
1. Check internet connection
2. Try different tile provider in FleetMap.tsx:
```typescript
<TileLayer
  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  // Or try:
  // url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png"
/>
```

#### Problem: CORS errors in console
**Error:** `Access to XMLHttpRequest blocked by CORS policy`

**Solution:**
```typescript
// In backend/src/main.ts
app.enableCors({
  origin: 'http://localhost:3000',
  credentials: true
});
```

### Performance Issues

#### Problem: Slow rendering with 100 vehicles
**Solutions:**

1. **Reduce update frequency:**
```typescript
// In backend/src/event-generator.ts
setInterval(() => {
  // ... update logic
}, 2000); // Change from 1000 to 2000
```

2. **Batch updates:**
```typescript
// In frontend App.tsx
const [updateQueue, setUpdateQueue] = useState<Vehicle[]>([]);

useEffect(() => {
  const interval = setInterval(() => {
    if (updateQueue.length > 0) {
      setVehicles(prev => {
        const updated = new Map(prev);
        updateQueue.forEach(v => updated.set(v.id, v));
        return updated;
      });
      setUpdateQueue([]);
    }
  }, 100);
  return () => clearInterval(interval);
}, [updateQueue]);
```

3. **Disable animations:**
```css
/* In App.css */
.vehicle-marker {
  transition: none !important;
}
```

## Verification Checklist

Before demo, verify:

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Browser opens to http://localhost:3000
- [ ] Map loads with tiles visible
- [ ] 100 vehicles appear on map
- [ ] Vehicles are moving
- [ ] Can click vehicle to see details
- [ ] Filters work (toggle status checkboxes)
- [ ] EN_ROUTE vehicles show orange routes
- [ ] Battery indicators show correctly
- [ ] No console errors in browser
- [ ] WebSocket connection established (check Network tab)

## Quick Health Check

Run these commands to verify everything:

```bash
# Check if backend is running
curl http://localhost:3001/api/vehicles

# Should return JSON array of 100 vehicles

# Check if frontend is accessible
curl http://localhost:3000

# Should return HTML

# Check Node version
node --version  # Should be 18+

# Check npm version
npm --version   # Should be 8+
```

## Emergency Fallback

If nothing works and demo is in 5 minutes:

1. **Use screenshots/video** of working app
2. **Walk through code** instead of live demo
3. **Explain architecture** using diagrams
4. **Focus on design decisions** and thought process

Remember: The interview is about your thinking, not just working code!

## Getting Help

If stuck:
1. Check browser console for errors
2. Check backend terminal for errors
3. Read error messages carefully
4. Google specific error messages
5. Check package versions match README

## Clean Slate Reset

Nuclear option - start fresh:

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json dist
npm install
npm start

# Frontend
cd frontend
rm -rf node_modules package-lock.json build
npm install
npm start

# Clear browser cache and hard refresh
```

## Contact Info for Demo Day

If technical issues during demo:
- "I can show you the code and architecture instead"
- "I have screenshots of the working application"
- "Let me explain the design decisions I made"
- Stay calm and pivot to discussing the approach

---

**Remember:** Interviewers care more about your problem-solving and communication than perfect execution!
