// ==================== PANEL ADMIN ====================
    function abrirAdmin() {
        document.getElementById('adminModal').classList.add('active');
        cargarConfigAdmin();
        cargarBackups();
    }

    function cerrarAdmin() {
        document.getElementById('adminModal').classList.remove('active');
    }

    // Cerrar modal al hacer click fuera
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('adminModal');
        if (e.target === modal) {
            cerrarAdmin();
        }
    });

    function switchAdminTab(tab, event) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(tab === 'config' ? 'adminConfig' : 'adminBackups').classList.add('active');
        
        if (tab === 'backups') {
            cargarBackups();
        }
    }

    async function cargarConfigAdmin() {
    try {
        const resp = await fetch('/api/config');
        if (resp.ok) {
            const config = await resp.json();
            document.getElementById('inputAppName').value = config.appName || 'Mi Comercio';
            actualizarNombreApp(config.appName || 'Mi Comercio');
            
            // Cargar logo en el modal
            cargarLogoAdmin(config.logo);
        }
    } catch (error) {
        console.error('Error cargando config:', error);
    }
}

    async function guardarNombreApp() {
        const nombre = document.getElementById('inputAppName').value.trim();
        if (!nombre) {
            showToast('⚠️ Ingresá un nombre', 'error');
            return;
        }

        try {
            const resp = await fetch('/api/config/nombre', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre })
            });

            if (resp.ok) {
                actualizarNombreApp(nombre);
                showToast('✅ Nombre actualizado', 'success');
            } else {
                throw new Error('Error al guardar');
            }
        } catch (error) {
            showToast('❌ Error al guardar nombre', 'error');
        }
    }

    function actualizarNombreApp(nombre) {
    const appNameElement = document.getElementById('appName');
    const logoImg = document.getElementById('logoComercio');
    
    // Si hay logo visible, solo actualizamos el texto sin emoji
    if (logoImg && logoImg.style.display !== 'none' && logoImg.src) {
        appNameElement.textContent = nombre.toUpperCase();
    } else {
        // Si NO hay logo, mostramos solo el nombre
        appNameElement.textContent = nombre.toUpperCase();
    }
    
    document.title = nombre + ' - Sistema de Inventario';
}

// ==================== LOGO DEL COMERCIO ====================

// Preview del logo antes de guardar
function previewLogo(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('logoPreview');
        const placeholder = document.getElementById('logoPlaceholder');
        
        preview.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        
        document.getElementById('btnGuardarLogo').style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
}

// Guardar logo en el servidor
async function guardarLogo() {
    const input = document.getElementById('inputLogo');
    const file = input.files[0];
    
    if (!file) {
        showToast('⚠️ Seleccioná una imagen primero', 'error');
        return;
    }

    // Validar tamaño (max 500KB para no sobrecargar la BD)
    if (file.size > 500 * 1024) {
        showToast('⚠️ La imagen es muy grande. Máximo 500KB.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    try {
        const resp = await fetch('/api/config/logo', {
            method: 'POST',
            body: formData
        });

        const data = await resp.json();

        if (resp.ok) {
            showToast('✅ Logo guardado correctamente', 'success');
            actualizarLogoHeader(data.logo);
            document.getElementById('btnEliminarLogo').style.display = 'inline-block';
            document.getElementById('btnGuardarLogo').style.display = 'none';
            input.value = ''; // Limpiar input
        } else {
            showToast('❌ ' + (data.error || 'Error al guardar'), 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Error de conexión', 'error');
    }
}

// Eliminar logo
async function eliminarLogo() {
    if (!confirm('¿Eliminar el logo del comercio?')) return;

    try {
        const resp = await fetch('/api/config/logo', { method: 'DELETE' });

        if (resp.ok) {
            showToast('🗑️ Logo eliminado', 'success');
            
            // Resetear preview
            document.getElementById('logoPreview').style.display = 'none';
            document.getElementById('logoPlaceholder').style.display = 'block';
            document.getElementById('btnEliminarLogo').style.display = 'none';
            
            // Resetear header
            actualizarLogoHeader(null);
        }
    } catch (e) {
        showToast('❌ Error al eliminar', 'error');
    }
}

// Actualizar logo en el header
function actualizarLogoHeader(logoBase64) {
    const logoImg = document.getElementById('logoComercio');

    if (logoBase64) {
        logoImg.src = logoBase64;
        logoImg.style.display = 'block';
        // También actualizar el favicon
        actualizarFavicon(logoBase64);
    } else {
        logoImg.src = '';
        logoImg.style.display = 'none';
        // Restaurar favicon por defecto
        actualizarFavicon(null);
    }
}

// Actualizar favicon dinámicamente con el logo del usuario
function actualizarFavicon(logoBase64) {
    let favicon = document.querySelector('link[rel="icon"]');
    let appleFavicon = document.querySelector('link[rel="apple-touch-icon"]');

    if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
    }

    if (logoBase64) {
        favicon.type = 'image/png';
        favicon.href = logoBase64;
        if (appleFavicon) appleFavicon.href = logoBase64;
    } else {
        // Restaurar favicon por defecto
        favicon.type = 'image/svg+xml';
        favicon.href = '/icons/icon-32.svg';
        if (appleFavicon) appleFavicon.href = '/icons/icon-192.svg';
    }
}

// Cargar logo en el modal de admin
function cargarLogoAdmin(logoBase64) {
    const preview = document.getElementById('logoPreview');
    const placeholder = document.getElementById('logoPlaceholder');
    const btnEliminar = document.getElementById('btnEliminarLogo');
    
    if (logoBase64) {
        preview.src = logoBase64;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        btnEliminar.style.display = 'inline-block';
    } else {
        preview.style.display = 'none';
        placeholder.style.display = 'block';
        btnEliminar.style.display = 'none';
    }
}    

    async function cargarBackups() {
        const logDiv = document.getElementById('backupLog');
        logDiv.innerHTML = '<div class="backup-empty">Cargando...</div>';

        try {
            const resp = await fetch('/api/backups');
            if (!resp.ok) throw new Error('Error al cargar backups');
            
            const backups = await resp.json();

            if (!backups || backups.length === 0) {
                logDiv.innerHTML = '<div class="backup-empty">No hay backups registrados aún.<br>Se crearán automáticamente al realizar acciones.</div>';
                return;
            }

            logDiv.innerHTML = backups.map(b => `
                <div class="backup-item">
                    <div class="backup-info">
                        <div class="backup-date">📅 ${formatBackupDate(b.fecha)}</div>
                        <div class="backup-action">${b.accion}</div>
                        ${b.detalle ? `<div class="backup-detail">${b.detalle}</div>` : ''}
                    </div>
                    <button class="backup-restore-btn" onclick="restaurarBackup('${b.archivo}', '${b.accion.replace(/'/g, "\\'")}')">
                        🔄 Restaurar
                    </button>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error cargando backups:', error);
            logDiv.innerHTML = '<div class="backup-empty" style="color: #e74c3c;">Error al cargar backups</div>';
        }
    }

    function formatBackupDate(fechaStr) {
        // Formato: 2025-12-29_13-45-22
        const [fecha, hora] = fechaStr.split('_');
        const [year, month, day] = fecha.split('-');
        const [h, m, s] = hora.split('-');
        return `${day}/${month}/${year} ${h}:${m}:${s}`;
    }

    async function restaurarBackup(archivo, accion) {
        if (!confirm(`¿Restaurar al punto anterior?\n\n"${accion}"\n\n⚠️ Esto revertirá todos los cambios realizados después de este punto.\n\n📌 Después deberás reiniciar el servidor.`)) {
            return;
        }

        try {
            const resp = await fetch('/api/backups/restaurar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archivo })
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error || 'Error al restaurar');
            }

            if (data.requiereReinicio) {
                // Mostrar modal de instrucciones
                cerrarAdmin();
                alert('✅ Backup preparado para restaurar.\n\n📌 Para completar la restauración:\n\n1. Cerrá esta ventana\n2. Andá a la consola del servidor\n3. Presioná Ctrl+C para detenerlo\n4. Ejecutá: node server.js\n5. Recargá esta página');
            } else {
                showToast('✅ Base de datos restaurada. Recargando...', 'success');
                setTimeout(() => location.reload(), 1500);
            }

        } catch (error) {
            console.error('Error restaurando backup:', error);
            showToast(`❌ ${error.message}`, 'error');
        }
    }

    // Cerrar sesión
    async function cerrarSesion() {
        if (!confirm('¿Cerrar sesión?')) return;
        
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Error cerrando sesión:', error);
            window.location.href = '/login.html';
        }
    }

    // Verificar sesión y cargar datos al iniciar
    window.addEventListener('load', async () => {
        try {
            // Verificar si está logueado
            const sessionResp = await fetch('/api/session');
            const sessionData = await sessionResp.json();
            
            if (!sessionData.logueado) {
                window.location.href = '/login.html';
                return;
            }
            
            // Mostrar usuario actual
            document.getElementById('usuarioActual').textContent = `👤 ${sessionData.usuario}`;

            if (sessionData.usuario === 'admin') {
        const btn = document.getElementById('btnSuperAdmin');
        if (btn) btn.style.display = 'block';
    }
            
            // Cargar configuración (nombre y logo)
const configResp = await fetch('/api/config');
if (configResp.ok) {
    const config = await configResp.json();
    if (config.appName) {
        actualizarNombreApp(config.appName);
    }
    if (config.logo) {
        actualizarLogoHeader(config.logo);
    }
}
        } catch (e) {
            console.log('Error verificando sesión:', e);
            window.location.href = '/login.html';
        }
    });

    // ==================== FUNCIONES GENERALES ====================
    function switchTab(tab, ev) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // Mostrar tab seleccionado
    document.getElementById(tab).classList.add('active');
    if (ev && ev.target) ev.target.classList.add('active');

    // Cargar datos cuando necesario
    if (tab === 'cajas') cargarVentasDelMes();
    if (tab === 'cuentas') cargarCuentas();
    if (tab === 'promedios') cargarPromedios();
    if (tab === 'stock') cargarStockCompleto();
    if (tab === 'cambios') {
        document.getElementById('cambioFecha').valueAsDate = new Date();
        // Set default filter to current month
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('filtroMesCambios').value = currentMonth;
        cargarCambios();
    }
}

    function showAlert(elementId, message, type = 'success') {
        const el = document.getElementById(elementId);
        el.textContent = message;
        el.className = `alert ${type === 'success' ? 'alert-success' : type === 'danger' ? 'alert-danger' : 'alert-warning'} show`;
        setTimeout(() => el.classList.remove('show'), 5000);
    }

    function formatMoney(num) {
    const n = Number(num);
    if (!isFinite(n)) return '$0,00';
    
    // Separar parte entera y decimal
    const [entero, decimal = '00'] = n.toFixed(2).split('.');
    
    // Formatear parte entera con puntos para miles
    const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Retornar con formato argentino: $1.234,56
    return '$' + enteroFormateado + ',' + decimal;
}

function formatPercentage(num) {
    return num.toFixed(1).replace('.', ',');
}

// Lógica visual del Checkbox Cambio
document.getElementById('esCambio').addEventListener('change', function() {
    const precioInput = document.getElementById('precio');
    const cantidadInput = document.getElementById('cantidad');
    const totalDisplay = document.getElementById('totalACobrar');
    
    if (this.checked) {
        // Modo Devolución activado
        precioInput.dataset.oldValue = precioInput.value;

        // Poner Precio en 0 y bloquear
        precioInput.value = 0;
        precioInput.readOnly = true;
        precioInput.style.backgroundColor = '#f0f0f0';

        // Poner Cantidad en -1 (para que sea visual)
        cantidadInput.value = -1;

        // Total en $0 con estilo rojo
        totalDisplay.value = '$0';
        totalDisplay.style.background = '#dc3545';
        totalDisplay.style.color = 'white';

        // Ocultar total exacto si estaba visible
        const totalExacto = document.getElementById('totalExacto');
        if (totalExacto) totalExacto.classList.remove('visible');
    } else {
        // Volver a normal
        precioInput.value = precioInput.dataset.oldValue || '';
        precioInput.readOnly = false;
        precioInput.style.backgroundColor = '';
        
        // Volver cantidad a 1
        cantidadInput.value = 1;
        
        actualizarTotalACobrar();
    }
});

// ==================== TABS VENTA/CAMBIO ====================
function switchVentaCambioTab(tab, event) {
    document.querySelectorAll('.venta-cambio-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.venta-cambio-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tab === 'venta' ? 'tabVenta' : 'tabCambio').classList.add('active');
    
    // Inicializar fecha del cambio si es ese tab
    if (tab === 'cambio') {
        document.getElementById('cambioFecha').valueAsDate = new Date();
    }
}

// ==================== LÓGICA DE CAMBIOS ====================
let cambioDevuelto = null;
let cambioNuevo = null;

// Buscar artículo devuelto
document.getElementById('cambioArticuloDevuelto')?.addEventListener('input', async function() {
    const codigo = this.value.trim();
    const infoDiv = document.getElementById('cambioInfoDevuelto');
    
    if (codigo.length < 3) {
        infoDiv.style.display = 'none';
        cambioDevuelto = null;
        actualizarResumenCambio();
        return;
    }
    
    try {
        const response = await fetch(`/api/productos/buscar?codigo=${encodeURIComponent(codigo)}`);
        if (response.ok) {
            cambioDevuelto = await response.json();
            infoDiv.innerHTML = `
                <div class="info-item">
                    <div class="info-label">Código</div>
                    <div class="info-value">${cambioDevuelto.codigo}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Descripción</div>
                    <div class="info-value">${cambioDevuelto.descripcion || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Precio</div>
                    <div class="info-value" style="color: #e74c3c;">${formatMoney(cambioDevuelto.precioPublico)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Stock actual</div>
                    <div class="info-value">${cambioDevuelto.stock}</div>
                </div>
            `;
            infoDiv.style.display = 'grid';
        } else {
            infoDiv.innerHTML = '<div style="color: #e74c3c; padding: 10px;">Producto no encontrado</div>';
            infoDiv.style.display = 'block';
            cambioDevuelto = null;
        }
    } catch (error) {
        console.error('Error buscando producto:', error);
        cambioDevuelto = null;
    }
    actualizarResumenCambio();
});

// Buscar artículo nuevo
document.getElementById('cambioArticuloNuevo')?.addEventListener('input', async function() {
    const codigo = this.value.trim();
    const infoDiv = document.getElementById('cambioInfoNuevo');
    
    if (codigo.length < 3) {
        infoDiv.style.display = 'none';
        cambioNuevo = null;
        actualizarResumenCambio();
        return;
    }
    
    try {
        const response = await fetch(`/api/productos/buscar?codigo=${encodeURIComponent(codigo)}`);
        if (response.ok) {
            cambioNuevo = await response.json();
            infoDiv.innerHTML = `
                <div class="info-item">
                    <div class="info-label">Código</div>
                    <div class="info-value">${cambioNuevo.codigo}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Descripción</div>
                    <div class="info-value">${cambioNuevo.descripcion || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Precio</div>
                    <div class="info-value" style="color: #27ae60;">${formatMoney(cambioNuevo.precioPublico)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Stock actual</div>
                    <div class="info-value">${cambioNuevo.stock}</div>
                </div>
            `;
            infoDiv.style.display = 'grid';
        } else {
            infoDiv.innerHTML = '<div style="color: #e74c3c; padding: 10px;">Producto no encontrado</div>';
            infoDiv.style.display = 'block';
            cambioNuevo = null;
        }
    } catch (error) {
        console.error('Error buscando producto:', error);
        cambioNuevo = null;
    }
    actualizarResumenCambio();
});

function actualizarResumenCambio() {
    const resumenDiv = document.getElementById('cambioResumen');
    const btnRegistrar = document.getElementById('btnRegistrarCambio');
    const opcionesPago = document.getElementById('cambioOpcionesPago');
    
    if (!cambioDevuelto || !cambioNuevo) {
        resumenDiv.style.display = 'none';
        btnRegistrar.style.display = 'none';
        return;
    }
    
    const precioDevuelto = cambioDevuelto.precioPublico || 0;
    const precioNuevo = cambioNuevo.precioPublico || 0;
    const diferencia = precioNuevo - precioDevuelto;
    
    const mensajeDiv = document.getElementById('cambioMensaje');
    const diferenciaDiv = document.getElementById('cambioDiferencia');
    const infoSaldoFavor = document.getElementById('cambioInfoSaldoFavor');
    
    resumenDiv.style.display = 'block';
    btnRegistrar.style.display = 'block';
    
    if (diferencia > 0) {
        // Cliente debe pagar
        mensajeDiv.textContent = 'El cliente debe abonar la diferencia:';
        diferenciaDiv.textContent = formatMoney(diferencia);
        diferenciaDiv.className = 'cambio-diferencia cobrar';
        opcionesPago.style.display = 'block';
        infoSaldoFavor.style.display = 'none';
    } else if (diferencia < 0) {
        // Saldo a favor del cliente
        mensajeDiv.textContent = 'El cliente tiene saldo a favor:';
        diferenciaDiv.textContent = formatMoney(Math.abs(diferencia));
        diferenciaDiv.className = 'cambio-diferencia favor';
        opcionesPago.style.display = 'none';
        infoSaldoFavor.style.display = 'block';
    } else {
        // Sin diferencia
        mensajeDiv.textContent = 'Cambio sin diferencia de precio';
        diferenciaDiv.textContent = '$0,00';
        diferenciaDiv.className = 'cambio-diferencia neutro';
        opcionesPago.style.display = 'none';
        infoSaldoFavor.style.display = 'none';
    }
}

// Toggle factura en cambios
document.querySelectorAll('.cambio-factura').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.cambio-factura').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    });
});

async function registrarCambio() {
    if (!cambioDevuelto || !cambioNuevo) {
        showToast('⚠️ Selecciona ambos artículos', 'error');
        return;
    }
    
    const fecha = document.getElementById('cambioFecha').value;
    if (!fecha) {
        showToast('⚠️ Selecciona la fecha', 'error');
        return;
    }
    
    const precioDevuelto = cambioDevuelto.precioPublico || 0;
    const precioNuevo = cambioNuevo.precioPublico || 0;
    const diferencia = precioNuevo - precioDevuelto;
    const comentarios = document.getElementById('cambioComentarios').value.trim();
    
    const btnRegistrar = document.getElementById('btnRegistrarCambio');
    const textoOriginal = btnRegistrar.innerHTML;
    btnRegistrar.disabled = true;
    btnRegistrar.innerHTML = 'Procesando... <span class="loading-spinner"></span>';
    
    try {
        // 1. Devolver stock del artículo devuelto (sumar)
        const respDevolver = await fetch(`/api/productos/${encodeURIComponent(cambioDevuelto.codigo)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                precioPublico: cambioDevuelto.precioPublico,
                costo: cambioDevuelto.costo,
                stockFinal: cambioDevuelto.stock + 1
            })
        });
        
        if (!respDevolver.ok) {
            throw new Error('Error al devolver stock del artículo');
        }
        
        // 2. Descontar stock del artículo nuevo (restar)
        const respNuevo = await fetch(`/api/productos/${encodeURIComponent(cambioNuevo.codigo)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                precioPublico: cambioNuevo.precioPublico,
                costo: cambioNuevo.costo,
                stockFinal: cambioNuevo.stock - 1
            })
        });
        
        if (!respNuevo.ok) {
            throw new Error('Error al descontar stock del artículo nuevo');
        }
        
        // 3. Registrar el cambio en la tabla de cambios
        const respCambio = await fetch('/api/cambios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fecha,
                articuloDevuelto: cambioDevuelto.codigo,
                articuloNuevo: cambioNuevo.codigo,
                precioDevuelto,
                precioNuevo,
                diferencia,
                comentarios
            })
        });
        
        if (!respCambio.ok) {
            console.warn('No se pudo registrar en tabla de cambios (puede que no exista el endpoint)');
        }
        
        // 4. Si hay diferencia a cobrar, registrar como venta
        if (diferencia > 0) {
            const facturaBtn = document.querySelector('.cambio-factura.active');
            const tipoPago = document.getElementById('cambioTipoPago').value;
            
            const ventaResp = await fetch('/api/ventas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha,
                    articulo: cambioNuevo.codigo,
                    cantidad: 0, // No afecta stock, ya lo ajustamos
                    precio: diferencia,
                    descuento: 0,
                    categoria: cambioNuevo.categoria || '',
                    factura: facturaBtn?.dataset.value || 'A',
                    tipoPago,
                    comentarios: `CAMBIO: ${cambioDevuelto.codigo} → ${cambioNuevo.codigo}. ${comentarios}`
                })
            });
            
            if (!ventaResp.ok) {
                console.warn('No se pudo registrar la diferencia como venta');
            }
        }
        
        // Éxito
        showToast('✅ Cambio registrado correctamente', 'success');
        
        // Limpiar formulario
        document.getElementById('cambioArticuloDevuelto').value = '';
        document.getElementById('cambioArticuloNuevo').value = '';
        document.getElementById('cambioInfoDevuelto').style.display = 'none';
        document.getElementById('cambioInfoNuevo').style.display = 'none';
        document.getElementById('cambioResumen').style.display = 'none';
        document.getElementById('btnRegistrarCambio').style.display = 'none';
        document.getElementById('cambioComentarios').value = '';
        cambioDevuelto = null;
        cambioNuevo = null;
        
        // Recargar tabla de cambios
        cargarCambios();
        
    } catch (error) {
        console.error('Error en registrarCambio:', error);
        showToast(`❌ ${error.message}`, 'error');
    } finally {
        btnRegistrar.disabled = false;
        btnRegistrar.innerHTML = textoOriginal;
    }
}

// ==================== CARGAR Y MOSTRAR CAMBIOS ====================
async function cargarCambios() {
    const filtroMes = document.getElementById('filtroMesCambios')?.value;
    let url = '/api/cambios';
    
    if (filtroMes) {
        const [year, month] = filtroMes.split('-');
        const desde = `${year}-${month}-01`;
        const hasta = `${year}-${month}-31`;
        url = `/api/cambios/reporte?desde=${desde}&hasta=${hasta}`;
    }
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const cambios = data.cambios || data;
        const stats = data.stats;
        
        const tbody = document.getElementById('tablaCambiosBody');
        
        if (!cambios || cambios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="padding: 20px; text-align: center; color: #888;">No hay cambios registrados</td></tr>';
            document.getElementById('cambiosStats').style.display = 'none';
            return;
        }
        
        tbody.innerHTML = cambios.map(c => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">${formatFecha(c.fecha)}</td>
                <td style="padding: 12px; font-family: monospace;">${c.articuloDevuelto}</td>
                <td style="padding: 12px; font-family: monospace;">${c.articuloNuevo}</td>
                <td style="padding: 12px; text-align: right;">${formatMoney(c.precioDevuelto)}</td>
                <td style="padding: 12px; text-align: right;">${formatMoney(c.precioNuevo)}</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: ${c.diferencia > 0 ? '#27ae60' : c.diferencia < 0 ? '#e74c3c' : '#f39c12'};">
                    ${c.diferencia > 0 ? '+' : ''}${formatMoney(c.diferencia)}
                </td>
                <td style="padding: 12px; color: #666; font-size: 0.9em;">${c.comentarios || '-'}</td>
                <td style="padding: 12px; text-align: center; white-space: nowrap;">
                    ${c.diferencia < 0 ? `
                        <button onclick="crearCCdesdeCambio(${c.id}, ${Math.abs(c.diferencia)}, '${c.fecha}', '${c.articuloDevuelto}', '${c.articuloNuevo}')" 
                                style="background: #f39c12; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;"
                                title="Crear cuenta corriente con saldo a favor">💰</button>
                    ` : ''}
                    <button onclick="eliminarCambio(${c.id}, '${c.articuloDevuelto}', '${c.articuloNuevo}')" 
                            style="background: #e74c3c; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"
                            title="Eliminar cambio">🗑️</button>
                </td>
            </tr>
        `).join('');
        
        // Mostrar estadísticas si hay
        if (stats) {
            document.getElementById('statTotalCambios').textContent = stats.totalCambios;
            document.getElementById('statDiferenciaPositiva').textContent = formatMoney(stats.diferenciaPositiva);
            document.getElementById('statDiferenciaNegativa').textContent = formatMoney(stats.diferenciaNegativa);
            document.getElementById('cambiosStats').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error cargando cambios:', error);
        document.getElementById('tablaCambiosBody').innerHTML = '<tr><td colspan="8" style="padding: 20px; text-align: center; color: #e74c3c;">Error al cargar cambios</td></tr>';
    }
}

function formatFecha(fecha) {
    if (!fecha) return '-';
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
}

async function eliminarCambio(id, articuloDevuelto, articuloNuevo) {
    if (!confirm(`¿Eliminar este cambio?\n\n${articuloDevuelto} → ${articuloNuevo}\n\nSe revertirán los cambios de stock.`)) {
        return;
    }
    
    try {
        // 1. Obtener datos del cambio para revertir
        const cambiosResp = await fetch('/api/cambios');
        const cambios = await cambiosResp.json();
        const cambio = cambios.find(c => c.id === id);
        
        if (!cambio) {
            showToast('❌ No se encontró el cambio', 'error');
            return;
        }
        
        // 2. Obtener productos actuales
        const devueltoResp = await fetch(`/api/productos/buscar?codigo=${encodeURIComponent(cambio.articuloDevuelto)}`);
        const nuevoResp = await fetch(`/api/productos/buscar?codigo=${encodeURIComponent(cambio.articuloNuevo)}`);
        
        if (devueltoResp.ok) {
            const devuelto = await devueltoResp.json();
            // Restar 1 del stock del devuelto (revertir la devolución)
            await fetch(`/api/productos/${encodeURIComponent(cambio.articuloDevuelto)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    precioPublico: devuelto.precioPublico,
                    costo: devuelto.costo,
                    stockFinal: devuelto.stock - 1
                })
            });
        }
        
        if (nuevoResp.ok) {
            const nuevo = await nuevoResp.json();
            // Sumar 1 al stock del nuevo (revertir la entrega)
            await fetch(`/api/productos/${encodeURIComponent(cambio.articuloNuevo)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    precioPublico: nuevo.precioPublico,
                    costo: nuevo.costo,
                    stockFinal: nuevo.stock + 1
                })
            });
        }
        
        // 3. Eliminar el registro del cambio
        const deleteResp = await fetch(`/api/cambios/${id}`, {
            method: 'DELETE'
        });
        
        if (!deleteResp.ok) {
            throw new Error('Error al eliminar el registro');
        }
        
        showToast('✅ Cambio eliminado y stock revertido', 'success');
        cargarCambios();
        
    } catch (error) {
        console.error('Error eliminando cambio:', error);
        showToast(`❌ ${error.message}`, 'error');
    }
}

async function crearCCdesdeCambio(cambioId, monto, fecha, artDevuelto, artNuevo) {
    const cliente = prompt(`Crear cuenta corriente con saldo a favor de ${formatMoney(monto)}\n\nIngresá el nombre del cliente:`);
    
    if (!cliente || !cliente.trim()) {
        return; // Canceló o no ingresó nombre
    }
    
    const nombreCliente = cliente.trim();
    
    try {
        // 1. Crear la cuenta (si ya existe, no pasa nada)
        await fetch('/api/cuentas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente: nombreCliente })
        });
        
        // 2. Registrar el pago (saldo a favor)
        const pagoResp = await fetch(`/api/cuentas/${encodeURIComponent(nombreCliente)}/movimiento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo: 'pago',
                monto: monto,
                fecha: fecha,
                comentario: `Saldo a favor por cambio: ${artDevuelto} → ${artNuevo}`
            })
        });
        
        if (!pagoResp.ok) {
            throw new Error('Error al registrar el saldo a favor');
        }
        
        showToast(`✅ Cuenta corriente creada para ${nombreCliente} con saldo a favor de ${formatMoney(monto)}`, 'success');
        
    } catch (error) {
        console.error('Error creando CC:', error);
        showToast(`❌ ${error.message}`, 'error');
    }
}

    // ==================== FECHA POR DEFECTO ====================
// Usamos la hora local del navegador (PC del usuario)
const hoy = new Date();
const year = hoy.getFullYear();
const month = String(hoy.getMonth() + 1).padStart(2, '0');
const day = String(hoy.getDate()).padStart(2, '0');
const fechaLocal = `${year}-${month}-${day}`;

document.getElementById('fecha').value = fechaLocal;

    // ==================== FACTURA A/B TOGGLE ====================
    document.querySelectorAll('.factura-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.factura-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // ==================== MOSTRAR "OTRO TIPO DE PAGO" ====================
    document.getElementById('tipoPago').addEventListener('change', function() {
        const otroContainer = document.getElementById('otroTipoPagoContainer');
        if (this.value === 'otro') {
            otroContainer.style.display = 'block';
        } else {
            otroContainer.style.display = 'none';
        }
    });

// ==================== 1. BÚSQUEDA DE PRECIOS (LÓGICA MEJORADA) ====================

document.getElementById('busquedaInput')?.addEventListener('keyup', (e) => {
    const texto = e.target.value.toLowerCase().trim();
    const contenedor = document.getElementById('busquedaResultado');

    // 1. Limpiar si está vacío
    if (texto.length === 0) {
        contenedor.innerHTML = '';
        return;
    }

    // 2. FILTRAR (Lógica ajustada)
    let encontrados = productosCache.filter(p => {
        const codigo = (p.codigo || '').toLowerCase();
        const desc = (p.descripcion || '').toLowerCase();
        
        // A. CÓDIGO: Debe EMPEZAR con el texto (Estricto)
        const coincideCodigo = codigo.startsWith(texto);
        
        // B. DESCRIPCIÓN: Puede CONTENER el texto (Flexible)
        const coincideDesc = desc.includes(texto);

        return coincideCodigo || coincideDesc;
    });

    // 3. ORDENAR RESULTADOS (Para que sea más intuitivo)
    encontrados.sort((a, b) => {
        const codigoA = (a.codigo || '').toLowerCase();
        const codigoB = (b.codigo || '').toLowerCase();

        // 1ro: Prioridad absoluta si el código es IDÉNTICO a lo que escribiste
        if (codigoA === texto && codigoB !== texto) return -1;
        if (codigoB === texto && codigoA !== texto) return 1;

        // 2do: Prioridad a los que coinciden por CÓDIGO sobre los de DESCRIPCIÓN
        const aStart = codigoA.startsWith(texto);
        const bStart = codigoB.startsWith(texto);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;

        // 3ro: Si ambos coinciden por código, mostrar primero los más cortos (ej: "5" antes que "500")
        if (aStart && bStart) {
            return codigoA.length - codigoB.length;
        }

        return 0;
    });

    // 4. RENDERIZAR
    if (encontrados.length === 0) {
        contenedor.innerHTML = `<div class="alert alert-warning">❌ No se encontraron productos comenzando con "${texto}"</div>`;
    } 
    else if (encontrados.length === 1) {
        mostrarProductoDetalle(encontrados[0], contenedor);
    } 
    else {
        mostrarListaResultados(encontrados, contenedor);
    }
});

// Función para renderizar la lista de múltiples resultados
function mostrarListaResultados(productos, contenedor) {
    // Limitamos a 50 resultados para mantener la velocidad
    const muestra = productos.slice(0, 50);

    const html = `
        <div style="margin-bottom: 10px; color: #666; font-size: 0.9em;">
            Encontrados <strong>${productos.length}</strong> resultados:
        </div>
        <div class="resultados-busqueda-grid">
            ${muestra.map(p => {
                // Preparamos el objeto para pasarlo al onclick (escapando comillas)
                const pString = JSON.stringify(p).replace(/"/g, '&quot;');
                
                // Lógica visual del stock
                const stock = Number(p.stock) || 0;
                let claseStock = 'stock-ok'; // Verde
                if (stock <= 0) claseStock = 'stock-cero'; // Rojo
                else if (stock <= 5) claseStock = 'stock-bajo'; // Amarillo

                return `
                <div class="resultado-item-card" onclick="mostrarProductoDetalle(${pString}, document.getElementById('busquedaResultado'))">
                    
                    <div class="res-codigo">${p.codigo}</div>
                    
                    <div class="res-desc">${p.descripcion || 'Sin descripción'}</div>
                    
                    <div class="res-right">
                        <div class="res-precio">${formatMoney(p.precioPublico)}</div>
                        <span class="res-stock ${claseStock}">Stock: ${stock}</span>
                    </div>
                    
                </div>
                `;
            }).join('')}
        </div>
    `;
    contenedor.innerHTML = html;
}

// Esta función ya la tenías, pero asegurate de que esté así:
function mostrarProductoDetalle(producto, contenedor) {
    const precio = Number(producto.precioPublico) || 0;
    const costo  = Number(producto.costo) || 0;
    const stock  = Number(producto.stock);

    contenedor.innerHTML = `
        <div class="producto-resultado">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0;">${producto.descripcion}</h3>
                <button onclick="document.getElementById('busquedaResultado').innerHTML=''; document.getElementById('busquedaInput').value=''; document.getElementById('busquedaInput').focus();" 
                        style="background: none; border: none; font-size: 1.5em; cursor: pointer; color: #999;">×</button>
            </div>
            <div class="producto-grid">
                <div class="producto-item">
                    <label>Código</label>
                    <div class="valor">${producto.codigo}</div>
                </div>
                <div class="producto-item">
                    <label>Categoría</label>
                    <div class="valor">${producto.categoria || '-'}</div>
                </div>
                <div class="producto-item">
                    <label>Precio Público</label>
                    <div class="valor">${formatMoney(precio)}</div>
                </div>
                <div class="producto-item">
                    <label>Costo</label>
                    <div style="color: #999; font-size: 1.1em;">${formatMoney(costo)}</div>
                </div>
                <div class="producto-item">
                    <label>Stock</label>
                    <div class="valor" style="color: ${stock <= 0 ? '#d9534f' : stock <= 5 ? '#f0ad4e' : '#5cb85c'}">${stock}</div>
                </div>
            </div>
        </div>
    `;
}

    // ==================== 2. BÚSQUEDA RÁPIDA EN CAJAS DIARIAS ====================
    let productoActual = null;

    document.getElementById('busquedaRapida')?.addEventListener('keyup', async (e) => {
        const busqueda = e.target.value.trim();
        const resultado = document.getElementById('resultadoRapido');

        if (busqueda.length < 2) {
            resultado.innerHTML = busqueda.length === 1 ? '<div style="color:#999; padding:10px;">Escribí al menos 2 caracteres...</div>' : '';
            productoActual = null;
            return;
        }

        try {
            const response = await fetch(`/api/productos/buscar?q=${encodeURIComponent(busqueda)}`);
            
            if (!response.ok) {
                resultado.innerHTML = `<div class="alert alert-danger show">❌ No se encontraron productos</div>`;
                productoActual = null;
                return;
            }

            const data = await response.json();
            
            // Si hay múltiples resultados
            if (data.multiple) {
                resultado.innerHTML = `
                    <div class="resultados-lista" style="max-height: 250px;">
                        ${data.productos.map(p => `
                            <div class="resultado-item" onclick="seleccionarProductoVenta(${JSON.stringify(p).replace(/"/g, '&quot;')})">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong>${p.codigo}</strong> - ${p.descripcion}
                                    </div>
                                    <div style="text-align: right;">
                                        <span style="font-weight: bold; color: var(--primary);">${formatMoney(p.precioPublico || 0)}</span>
                                        <span style="font-size: 0.85em; color: ${(p.stock || 0) <= 0 ? '#d9534f' : '#5cb85c'}; margin-left: 10px;">Stock: ${p.stock || 0}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                productoActual = null;
            } else {
                // Un solo resultado - mostrar detalle
                productoActual = data;
                mostrarProductoVenta(data, resultado);
            }
        } catch (error) {
            resultado.innerHTML = `<div class="alert alert-danger show">⚠️ Error: ${error.message}</div>`;
            productoActual = null;
        }
    });

    function seleccionarProductoVenta(producto) {
        productoActual = producto;
        mostrarProductoVenta(producto, document.getElementById('resultadoRapido'));
    }

    function mostrarProductoVenta(producto, contenedor) {
        const precio = Number(producto.precioPublico) || 0;
        const stock = Number(producto.stock);

        contenedor.innerHTML = `
            <div class="producto-resultado">
                <h3>${producto.descripcion}</h3>
                <div class="producto-grid">
                    <div class="producto-item">
                        <label>Código</label>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="valor">${producto.codigo}</div>
                            <button class="btn-agregar-venta" onclick="agregarProductoAVenta()" style="margin: 0; padding: 6px 12px; font-size: 13px;">✓ Agregar</button>
                        </div>
                    </div>
                    <div class="producto-item">
                        <label>Categoría</label>
                        <div class="valor">${producto.categoria || '-'}</div>
                    </div>
                    <div class="producto-item">
                        <label>Precio Público</label>
                        <div class="valor">${formatMoney(precio)}</div>
                    </div>
                    <div class="producto-item">
                        <label>Stock</label>
                        <div class="valor" style="color: ${stock <= 0 ? '#d9534f' : stock <= 5 ? '#f0ad4e' : '#5cb85c'}">${stock}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==================== AGREGAR PRODUCTO DESDE BÚSQUEDA RÁPIDA ====================
    function agregarProductoAVenta() {
        if (!productoActual) return;
        
        document.getElementById('articulo').value = productoActual.codigo;
        document.getElementById('precio').value = productoActual.precioPublico || 0;
        document.getElementById('precio').dataset.original = productoActual.precioPublico || 0;
        document.getElementById('categoria').value = productoActual.categoria || '';
        document.getElementById('cantidad').value = 1;
        document.getElementById('descuento').value = 0;
        
        // Limpiar búsqueda rápida
        document.getElementById('busquedaRapida').value = '';
        document.getElementById('resultadoRapido').innerHTML = '';
        productoActual = null;

        // Actualizar total
  actualizarTotalACobrar();
        
        // Focus en cantidad
        document.getElementById('cantidad').focus();
    }

    // ==================== AUTOCOMPLETAR AL ESCRIBIR ARTÍCULO ====================
    let timeoutArticulo;
    document.getElementById('articulo').addEventListener('input', function() {
        clearTimeout(timeoutArticulo);
        const codigo = this.value.trim();
        
        if (!codigo) {
            document.getElementById('precio').value = '';
            document.getElementById('precio').dataset.original = '';
            document.getElementById('categoria').value = '';
            actualizarTotalACobrar(); // Limpiamos el total si borra el código
            return;
        }

        timeoutArticulo = setTimeout(async () => {
            try {
                const response = await fetch(`/api/productos/buscar?codigo=${codigo}`);
                if (response.ok) {
                    const producto = await response.json();
                    document.getElementById('precio').value = producto.precioPublico || 0;
                    document.getElementById('precio').dataset.original = producto.precioPublico || 0;
                    document.getElementById('categoria').value = producto.categoria || '';
                    
                    // ¡ESTO ES LO QUE FALTABA!
                    actualizarTotalACobrar(); 
                }
            } catch (error) {
                console.log('Producto no encontrado');
            }
        }, 500);
    });

    // ==================== RESETEAR PRECIO ORIGINAL SI SE EDITA MANUALMENTE ====================
document.getElementById('precio').addEventListener('input', function() {
    // Si el usuario edita el precio manualmente, ese se convierte en el "original"
    // (se resetea el dataset para que el descuento se aplique sobre lo que escribió)
    const descuentoActual = parseInt(document.getElementById('descuento').value);
    
    // Solo resetear si no hay descuento aplicado
    if (descuentoActual === 0) {
        this.dataset.original = '';
    }
});


    // ==================== ACTUALIZAR PRECIO AL CAMBIAR DESCUENTO ====================
document.getElementById('descuento').addEventListener('change', function() {
  const precioField = document.getElementById('precio');
  const precioActual = parseFloat(precioField.value);
  
  if (!precioActual || precioActual === 0) return;

  // Guardar el precio base la primera vez
  if (!precioField.dataset.original) {
    precioField.dataset.original = precioActual;
  }
});

// CALCULAR Y MOSTRAR TOTAL A COBRAR
function actualizarTotalACobrar() {
  const precioField = document.getElementById('precio');
  const cantidadField = document.getElementById('cantidad');
  const descuentoField = document.getElementById('descuento');
  const totalInput = document.getElementById('totalACobrar');
  const totalExacto = document.getElementById('totalExacto');

  const precio = parseFloat(precioField.value) || 0;
  const cantidadValor = parseInt(cantidadField.value);
  const cantidad = isNaN(cantidadValor) ? 0 : cantidadValor;
  const descuento = parseInt(descuentoField.value) || 0;

  // Verificar si el checkbox de devolución está marcado
  const esCambioCheckbox = document.getElementById('esCambio');
  const esCambio = esCambioCheckbox && esCambioCheckbox.checked;

  // Si es devolución (checkbox marcado O cantidad es -1), total siempre es 0
  if (esCambio || cantidad === -1) {
    totalInput.value = '$0';
    totalInput.style.background = '#dc3545'; // Rojo para devolución
    totalInput.style.color = 'white';
    totalExacto.classList.remove('visible');
    return;
  }

  if (precio === 0) {
    totalInput.value = '$0';
    totalInput.style.background = '#6c757d';
    totalExacto.classList.remove('visible');
    return;
  }

  // Resetear estilo si no es devolución
  totalInput.style.color = 'white';

  const precioConDescuento = precio * (1 - (descuento / 100));

  // Si cantidad es 0, total = precio. Si no, multiplicamos.
  let totalSinRedondear = (cantidad === 0) ? precioConDescuento : (precioConDescuento * cantidad);
  let totalRedondeado;

  // Redondear al múltiplo de 50 más cercano (para facilitar vuelto)
  if (descuento > 0) {
    totalRedondeado = Math.round(totalSinRedondear / 50) * 50;
    // Mostrar total exacto si hay diferencia
    if (Math.abs(totalRedondeado - totalSinRedondear) > 0.5) {
      totalExacto.textContent = formatMoney(Math.round(totalSinRedondear));
      totalExacto.classList.add('visible');
    } else {
      totalExacto.classList.remove('visible');
    }
  } else {
    totalRedondeado = Math.round(totalSinRedondear);
    totalExacto.classList.remove('visible');
  }

  totalInput.value = formatMoney(totalRedondeado);

  // Cambiar color según descuento
  if (descuento > 0) {
    totalInput.style.background = '#28a745'; // Verde
    totalInput.style.color = 'white';
  } else {
    totalInput.style.background = '#007bff'; // Azul
    totalInput.style.color = 'white';
  }
}

// Llamar la función cuando cambie precio, cantidad o descuento
document.getElementById('precio').addEventListener('input', actualizarTotalACobrar);
document.getElementById('cantidad').addEventListener('input', actualizarTotalACobrar);
document.getElementById('descuento').addEventListener('change', actualizarTotalACobrar);


// ==================== VENTAS MÚLTIPLES - Lista temporal ====================
let articulosPendientes = []; // Array temporal para múltiples artículos

function obtenerDatosFormulario() {
    const facturaBtn = document.querySelector('.factura-btn.active');
    const tipoPago = document.getElementById('tipoPago').value;
    const esCambio = document.getElementById('esCambio').checked;

    const precioField = document.getElementById('precio');
    const cantidadField = document.getElementById('cantidad');

    let cantidad = parseInt(cantidadField.value);
    let precio = parseFloat(precioField.value);

    // LÓGICA DE CAMBIO/DEVOLUCIÓN
    if (esCambio) {
        cantidad = -1 * Math.abs(cantidad);
        precio = 0;
    }

    // Obtener total del input (puede ser editado manualmente)
    const totalInput = document.getElementById('totalACobrar');
    const totalManual = parseFloat(totalInput.value.replace(/[$.]/g, '').replace(',', '.')) || 0;
    const descuentoOriginal = esCambio ? 0 : (parseInt(document.getElementById('descuento').value) || 0);

    let precioFinal = precio;
    let descuentoFinal = descuentoOriginal;

    const cantidadParaCalculo = cantidad === 0 ? 1 : Math.abs(cantidad);
    const precioCalculado = totalManual / cantidadParaCalculo;

    // Verificar si el usuario modificó el total manualmente
    const totalSinRedondear = precio * (1 - descuentoOriginal / 100) * cantidadParaCalculo;
    const totalEsperado = descuentoOriginal > 0
        ? Math.round(totalSinRedondear / 50) * 50
        : Math.round(totalSinRedondear);

    if (Math.abs(totalManual - totalEsperado) > 1) {
        precioFinal = precioCalculado;
        descuentoFinal = 0;
    }

    return {
        fecha: document.getElementById('fecha').value,
        articulo: document.getElementById('articulo').value.trim(),
        cantidad: cantidad,
        precio: precioFinal,
        descuento: descuentoFinal,
        categoria: document.getElementById('categoria').value.trim(),
        factura: facturaBtn.dataset.value,
        tipoPago: tipoPago,
        comentarios: document.getElementById('comentarios').value.trim() + (esCambio ? ' (DEVOLUCIÓN)' : ''),
        totalCalculado: totalManual,
        esCambio: esCambio
    };
}

function limpiarFormularioVenta() {
    document.getElementById('articulo').value = '';
    document.getElementById('precio').value = '';
    document.getElementById('precio').readOnly = false;
    document.getElementById('precio').style.backgroundColor = '';
    document.getElementById('categoria').value = '';
    document.getElementById('cantidad').value = 1;
    document.getElementById('descuento').value = 0;
    document.getElementById('comentarios').value = '';
    document.getElementById('esCambio').checked = false;
    document.getElementById('tipoPago').value = 'Otro';
    actualizarTotalACobrar();
}

function agregarArticuloALista(event) {
    const tipoPago = document.getElementById('tipoPago').value;

    // Interceptar Cta Cte
    if (tipoPago === 'Cta Cte') {
        abrirModalCtaCte();
        return;
    }

    const precio = parseFloat(document.getElementById('precio').value);
    const esCambio = document.getElementById('esCambio').checked;

    if (!esCambio && isNaN(precio)) {
        showToast('⚠️ Falta el precio', 'error');
        return;
    }

    const datos = obtenerDatosFormulario();

    // Agregar descripción para mostrar en la lista
    const codigo = datos.articulo;
    let descripcion = '-';
    if (window.productosCache && codigo) {
        const prod = window.productosCache.find(p =>
            (p.codigo || '').toString().trim().toLowerCase() === codigo.toString().trim().toLowerCase()
        );
        if (prod) descripcion = prod.descripcion;
    }
    datos.descripcion = descripcion;

    articulosPendientes.push(datos);
    renderizarArticulosPendientes();
    limpiarFormularioVenta();
    document.getElementById('articulo').focus();

    showToast('✅ Artículo agregado a la venta', 'success');
}

function renderizarArticulosPendientes() {
    const container = document.getElementById('articulosPendientes');
    const lista = document.getElementById('listaArticulosPendientes');
    const contador = document.getElementById('contadorArticulos');
    const totalSpan = document.getElementById('totalGrupo');

    if (articulosPendientes.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    contador.textContent = `${articulosPendientes.length} artículo${articulosPendientes.length > 1 ? 's' : ''}`;

    let totalGrupo = 0;

    lista.innerHTML = articulosPendientes.map((art, index) => {
        totalGrupo += art.totalCalculado;
        const esDevolucion = art.esCambio;

        return `
            <div class="articulo-pendiente-item ${esDevolucion ? 'es-devolucion' : ''}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: ${esDevolucion ? 'rgba(231,76,60,0.1)' : 'rgba(255,255,255,0.8)'}; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid ${esDevolucion ? '#e74c3c' : '#27ae60'};">
                <div style="flex: 1;">
                    <strong style="color: #2c3e50;">${art.articulo || 'Sin código'}</strong>
                    <span style="color: #7f8c8d; margin-left: 10px;">${art.descripcion}</span>
                    <div style="font-size: 0.85em; color: #95a5a6; margin-top: 3px;">
                        Cant: ${art.cantidad} | ${art.descuento > 0 ? art.descuento + '% desc.' : 'Sin desc.'} | ${art.factura} | ${art.tipoPago}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-weight: bold; font-size: 1.1em; color: ${esDevolucion ? '#e74c3c' : '#27ae60'};">
                        ${esDevolucion ? 'DEV' : formatMoney(art.totalCalculado)}
                    </span>
                    <button onclick="quitarArticuloPendiente(${index})" style="background: #e74c3c; color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 1.1em;">×</button>
                </div>
            </div>
        `;
    }).join('');

    totalSpan.textContent = formatMoney(totalGrupo);
}

function quitarArticuloPendiente(index) {
    articulosPendientes.splice(index, 1);
    renderizarArticulosPendientes();
    showToast('Artículo removido', 'info');
}

function limpiarArticulosPendientes() {
    articulosPendientes = [];
    renderizarArticulosPendientes();
    showToast('Venta cancelada', 'info');
}

async function registrarVentaCompleta() {
    if (articulosPendientes.length === 0) {
        showToast('⚠️ No hay artículos para registrar', 'error');
        return;
    }

    const btnRegistrar = event?.target;
    const textoOriginal = btnRegistrar?.innerHTML;

    if (btnRegistrar) {
        btnRegistrar.disabled = true;
        btnRegistrar.innerHTML = 'Procesando...';
    }

    try {
        const grupoVenta = Date.now().toString();

        const payload = {
            grupoVenta: grupoVenta,
            articulos: articulosPendientes.map(art => ({
                fecha: art.fecha,
                articulo: art.articulo,
                cantidad: art.cantidad,
                precio: art.precio,
                descuento: art.descuento,
                categoria: art.categoria,
                factura: art.factura,
                tipoPago: art.tipoPago,
                comentarios: art.comentarios
            }))
        };

        const response = await fetch('/api/ventas/multiple', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            showToast(`✅ ${data.mensaje}`, 'success');
            articulosPendientes = [];
            renderizarArticulosPendientes();
            limpiarFormularioVenta();
            cargarVentasDelMes();
        } else {
            const data = await response.json();
            showToast(`❌ Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('❌ Error de conexión', 'error');
    } finally {
        if (btnRegistrar) {
            btnRegistrar.disabled = false;
            btnRegistrar.innerHTML = textoOriginal;
        }
    }
}

    // ==================== REGISTRAR VENTA RÁPIDA (1 artículo) ====================
    async function registrarVentaRapida(event) {
    const btnRegistrar = event?.target;
    const textoOriginal = btnRegistrar?.innerHTML;
    
    if (btnRegistrar) {
        btnRegistrar.disabled = true;
        btnRegistrar.innerHTML = 'Procesando...';
    }
    
    try {
        const facturaBtn = document.querySelector('.factura-btn.active');
        const tipoPago = document.getElementById('tipoPago').value; // Toma directo del select
        const esCambio = document.getElementById('esCambio').checked;

        // === INTERCEPCIÓN CTA CTE ===
        if (tipoPago === 'Cta Cte') {
            abrirModalCtaCte(); // Abrimos modal y frenamos acá
            if (btnRegistrar) { // Restaurar botón
                btnRegistrar.disabled = false;
                btnRegistrar.innerHTML = textoOriginal;
            }
            return; 
        }
        
        const precioField = document.getElementById('precio');
        const cantidadField = document.getElementById('cantidad');
        
        // Convertimos a números
        let cantidad = parseInt(cantidadField.value);
        let precio = parseFloat(precioField.value);
        
        // Validaciones básicas de cliente
       /* if (!document.getElementById('articulo').value) {
             showToast('⚠️ Falta el código del artículo', 'error');
             return;
        }*/

        // LÓGICA DE CAMBIO
        if (esCambio) {
            // Aseguramos que sea negativo y precio 0
            cantidad = -1 * Math.abs(cantidad); 
            precio = 0; 
        } else {
            // Lógica normal: Si precio está vacío es error, salvo que sea cambio
            if (isNaN(precio)) {
                 showToast('⚠️ Falta el precio', 'error');
                 return;
            }
            // Recalcular unitario si había descuento aplicado visualmente, etc.
            // Para simplificar, confiamos en lo que dice el input "Precio" que es unitario
        }
        
        // Obtener total del input (puede ser editado manualmente)
        // Parsear quitando $ y puntos de miles
        const totalInput = document.getElementById('totalACobrar');
        const totalManual = parseFloat(totalInput.value.replace(/[$.]/g, '').replace(',', '.')) || 0;
        const descuentoOriginal = esCambio ? 0 : (parseInt(document.getElementById('descuento').value) || 0);

        // Calcular qué precio unitario debería ser según el total ingresado
        // Si el usuario editó el total manualmente, usamos ese total y calculamos el precio
        let precioFinal = precio;
        let descuentoFinal = descuentoOriginal;

        // Si cantidad > 0, el precio unitario es total / cantidad
        // Si cantidad = 0, el precio es el total directo
        const cantidadParaCalculo = cantidad === 0 ? 1 : Math.abs(cantidad);
        const precioCalculado = totalManual / cantidadParaCalculo;

        // Verificar si el usuario modificó el total manualmente
        const totalSinRedondear = precio * (1 - descuentoOriginal / 100) * cantidadParaCalculo;
        const totalEsperado = descuentoOriginal > 0
            ? Math.round(totalSinRedondear / 50) * 50
            : Math.round(totalSinRedondear);

        if (Math.abs(totalManual - totalEsperado) > 1) {
            // El usuario editó el total manualmente, usar ese precio y sin descuento
            precioFinal = precioCalculado;
            descuentoFinal = 0;
        }

        const venta = {
            fecha: document.getElementById('fecha').value,
            articulo: document.getElementById('articulo').value.trim(),
            cantidad: cantidad,
            precio: precioFinal,
            descuento: descuentoFinal,
            categoria: document.getElementById('categoria').value.trim(),
            factura: facturaBtn.dataset.value,
            tipoPago: tipoPago,
            comentarios: document.getElementById('comentarios').value.trim() + (esCambio ? ' (DEVOLUCIÓN)' : '')
        };

        const response = await fetch('/api/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(venta)
        });

        if (response.ok) {
            showToast(esCambio ? '✅ Devolución registrada (Stock +1)' : '✅ Venta registrada', 'success');
            
            // Resetear formulario
            document.getElementById('articulo').value = '';
            document.getElementById('articulo').focus();
            
            // Resetear precio y modo
            precioField.value = '';
            precioField.readOnly = false;
            precioField.style.backgroundColor = '';
            
            document.getElementById('categoria').value = '';
            cantidadField.value = 1;
            document.getElementById('descuento').value = 0;
            document.getElementById('comentarios').value = '';
            document.getElementById('esCambio').checked = false; // Destildar cambio
            
            // Volver select de pago a default (opcional)
            document.getElementById('tipoPago').value = 'Otro';

            actualizarTotalACobrar();
            cargarVentasDelMes();
        } else {
            const data = await response.json();
            showToast(`❌ Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('❌ Error de conexión', 'error');
    } finally {
        if (btnRegistrar) {
            btnRegistrar.disabled = false;
            btnRegistrar.innerHTML = textoOriginal;
        }
    }
}

// ==================== EDITAR COMENTARIO POST VENTA (mejorado) ====================
async function editarComentarioVenta(id, textoActual) {
    // CAMBIO: Ahora el segundo parámetro es 'textoActual'.
    // Esto hace que el cuadro de diálogo muestre lo que ya estaba escrito.
    const nuevoComentario = prompt("Editar comentario:", textoActual);
    
    // Si es null, es que el usuario dio al botón "Cancelar" -> No hacemos nada.
    if (nuevoComentario === null) return; 

    try {
        const response = await fetch(`/api/ventas/${id}/comentario`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comentario: nuevoComentario.trim() })
        });

        if (response.ok) {
            showToast('✅ Comentario actualizado', 'success');
            
            // Actualizar memoria local para reflejo inmediato
            if (typeof ventasDelMes !== 'undefined') {
                const ventaLocal = ventasDelMes.find(v => v.id === id);
                if (ventaLocal) {
                    ventaLocal.comentarios = nuevoComentario.trim();
                }
            }

            // Recargar tabla
            if (typeof fechaSeleccionada !== 'undefined') {
                cargarVentasDelDia(fechaSeleccionada);
            }
        } else {
            const data = await response.json();
            showToast(`❌ Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('❌ Error de conexión', 'error');
    }
}

// ==================== BORRAR VENTAS ====================
async function borrarVenta(id) {
    if (!confirm('¿Estás seguro de eliminar esta venta? Se devolverá el stock.')) {
        return;
    }

    try {
        const response = await fetch(`/api/ventas/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.mensaje || '✅ Venta eliminada correctamente', 'success');
            if (data.warning) {
                console.warn(data.warning);
            }
            cargarVentasDelMes();
        } else {
            showToast(`❌ ${data.error || 'Error al eliminar la venta'}`, 'error');
        }
    } catch (error) {
        console.error('Error en borrarVenta:', error);
        showToast(`❌ Error de conexión: ${error.message}`, 'error');
    }
}

// ==================== SELECTOR DE DÍAS DEL MES ====================
let fechaSeleccionada = new Date().toISOString().split('T')[0];
let ventasDelMes = [];

async function cargarVentasDelMes() {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = hoy.getMonth();
    
    // Primer y último día del mes
    const primerDia = new Date(año, mes, 1).toISOString().split('T')[0];
    const ultimoDia = new Date(año, mes + 1, 0).toISOString().split('T')[0];
    
    try {
        const response = await fetch('/api/ventas');
        const todasVentas = await response.json();
        
        // Filtrar solo ventas del mes actual
        ventasDelMes = todasVentas.filter(v => v.fecha >= primerDia && v.fecha <= ultimoDia);
        
        generarDiasDelMes();
        cargarVentasDelDia(fechaSeleccionada);
        cargarCajaInicial(fechaSeleccionada);
    } catch (error) {
        console.error('Error cargando ventas del mes:', error);
    }
}

function generarDiasDelMes() {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = hoy.getMonth();
    const nombreMes = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    
    // Título del mes
    document.getElementById('mesActualTitulo').textContent = 
        nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
    
    // Calcular días del mes
    const diasEnMes = new Date(año, mes + 1, 0).getDate();
    const hoyStr = new Date().toISOString().split('T')[0];
    
    const diasHTML = [];
    
    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fecha = new Date(año, mes, dia);
        const fechaStr = fecha.toISOString().split('T')[0];
        const nombreDia = fecha.toLocaleDateString('es-AR', { weekday: 'short' });
        
        // Contar ventas de ese día
        const ventasDelDia = ventasDelMes.filter(v => v.fecha === fechaStr);
        const cantidadVentas = ventasDelDia.length;
        
        const esHoy = fechaStr === hoyStr;
        const esSeleccionado = fechaStr === fechaSeleccionada;
        
        diasHTML.push(`
            <button class="dia-btn ${esSeleccionado ? 'active' : ''} ${esHoy ? 'hoy' : ''}" 
                    onclick="seleccionarDia('${fechaStr}')">
                <span class="dia-numero">${dia}</span>
                <span class="dia-nombre">${nombreDia}</span>
                ${cantidadVentas > 0 ? `<span class="dia-ventas">📊 ${cantidadVentas}</span>` : ''}
            </button>
        `);
    }
    
    document.getElementById('diasDelMes').innerHTML = diasHTML.join('');
}

function seleccionarDia(fecha) {
    fechaSeleccionada = fecha;
    const inputFecha = document.getElementById('fecha');
    if (inputFecha) inputFecha.value = fecha;
    generarDiasDelMes(); // Re-renderizar para actualizar el activo
    cargarVentasDelDia(fecha);
    cargarCajaInicial(fecha);
}

// ==================== CARGAR VENTAS Y MOVIMIENTOS DEL DÍA ====================
async function cargarVentasDelDia(fecha) {
    // 1. Actualizar título
    const fechaObj = new Date(fecha + 'T00:00:00');
    const nombreDia = fechaObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('ventasDiaTitulo').textContent = 
        'Caja del ' + nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);
    
    const lista = document.getElementById('listaVentas');
    lista.innerHTML = '<div style="text-align:center; padding:20px;">Cargando operaciones...</div>';

    try {
        // 2. Traer TODO en paralelo
        const [movimientosResp, cajaInicialResp] = await Promise.all([
            fetch(`/api/caja/movimientos/${fecha}`),
            fetch(`/api/caja-inicial/${fecha}`)
        ]);

        const movimientos = await movimientosResp.json();
        const cajaData = await cajaInicialResp.json();
        
        // Actualizar input de caja inicial visualmente
        const inputCaja = document.getElementById('cajaInicial');
        if(inputCaja) inputCaja.value = cajaData.monto > 0 ? formatMonedaInput(cajaData.monto) : '';
        const montoCajaInicial = cajaData.monto || 0;

        // Filtrar ventas de ESTE día
        const ventasDelDia = ventasDelMes.filter(v => v.fecha === fecha);

        // --- CÁLCULOS ---
        
        // A. Totales Ventas
        let totalVentas = 0;
        let totalFacturaA = 0;
        let totalFacturaB = 0;
        
        ventasDelDia.forEach(v => {
            const precioFinal = v.precio * (1 - (v.descuento || 0)/100);
            const total = (v.cantidad === 0) ? precioFinal : (precioFinal * v.cantidad);
            totalVentas += total;
            
            const tipoFactura = (v.factura || '').toUpperCase().trim();
            if (tipoFactura === 'A') totalFacturaA += total;
            else if (tipoFactura === 'B') totalFacturaB += total;
        });

        // B. Totales Movimientos (SOLO INFORMATIVO AHORA)
        let totalIngresos = 0;
        let totalEgresos = 0;

        movimientos.forEach(m => {
            if(m.tipo === 'ingreso') totalIngresos += m.monto;
            else totalEgresos += m.monto;
        });

        // CAMBIO CLAVE: El total final NO incluye movimientos, solo Caja Inicial + Ventas
        const totalEnCaja = montoCajaInicial + totalVentas;
        const netoMovimientos = totalIngresos - totalEgresos;

        // --- RENDERIZADO ---

        let html = '';

        // 1. TABLA DE VENTAS
        if (ventasDelDia.length === 0) {
            html += '<p style="color: #999; text-align:center; margin-bottom:20px;">No hay ventas registradas hoy</p>';
        } else {
            html += `
                <div class="ventas-tabla-grid venta-header">
                    <div>Ref</div>
                    <div>Artículo</div>   <div>Producto</div>
                    <div>Categ.</div>
                    <div style="text-align:center">Cant.</div>
                    <div style="text-align:right">Precio</div>
                    <div style="text-align:center">%</div>
                    <div style="text-align:right">Total</div>
                    <div>Pago</div>
                    <div style="text-align:center">FC</div>
                    <div style="text-align:center">🗑️</div>
                </div>
            `;
            // Agrupar ventas por grupoVenta
            const grupos = {};
            const ventasSinGrupo = [];

            ventasDelDia.forEach(v => {
                if (v.grupoVenta) {
                    if (!grupos[v.grupoVenta]) {
                        grupos[v.grupoVenta] = [];
                    }
                    grupos[v.grupoVenta].push(v);
                } else {
                    ventasSinGrupo.push(v);
                }
            });

            // Función para renderizar una fila de venta
            function renderizarFilaVenta(v, esParteDeGrupo = false, esPrimeroDelGrupo = false, esUltimoDelGrupo = false) {
                const precioFinal = v.precio * (1 - (v.descuento || 0)/100);
                const total = (v.cantidad === 0) ? precioFinal : (precioFinal * v.cantidad);
                const esDev = v.cantidad < 0 && v.precio == 0;

                const codigoReal = v.articulo || v.codigoArticulo || '???';
                let descripcionSegura = v.descripcion || '-';

                if (window.productosCache && window.productosCache.length > 0) {
                    const prodEncontrado = window.productosCache.find(p =>
                        (p.codigo || '').toString().trim().toLowerCase() === codigoReal.toString().trim().toLowerCase()
                    );
                    if (prodEncontrado && prodEncontrado.descripcion) {
                        descripcionSegura = prodEncontrado.descripcion;
                    }
                }

                const categoriaSegura = v.categoriaProducto || v.categoria || '';

                // Clases y estilos para grupo
                let claseGrupo = '';
                let estiloGrupo = '';
                if (esParteDeGrupo) {
                    claseGrupo = 'grupo-venta';
                    if (esPrimeroDelGrupo) claseGrupo += ' grupo-venta-primero';
                    if (esUltimoDelGrupo) claseGrupo += ' grupo-venta-ultimo';
                }

                const filaVenta = `
                <div class="ventas-tabla-grid venta-item ${esDev ? 'es-devolucion' : ''} ${claseGrupo}" style="${v.comentarios ? 'border-bottom: none;' : ''}">
                    <div class="venta-detail" style="font-size:0.85em; color:#888;">#${v.id}</div>
                    <div class="venta-detail" style="font-weight:600; color:#2c3e50;">${codigoReal}</div>
                    <div class="venta-detail" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#444;" title="${descripcionSegura}">
                        ${descripcionSegura}
                    </div>
                    <div class="venta-detail" style="font-size:0.85em; color:#666;">${categoriaSegura}</div>
                    <div class="venta-detail" style="text-align:center;">${esDev ? '<span style="color:red">-1</span>' : v.cantidad}</div>
                    <div class="venta-detail" style="text-align:right;">${formatMoney(v.precio)}</div>
                    <div class="venta-detail" style="text-align:center; font-size:0.8em;">${v.descuento ? v.descuento+'%' : '-'}</div>
                    <div class="venta-detail" style="text-align:right; font-weight:bold;">${esDev ? 'Dev.' : formatMoney(total)}</div>
                    <div class="venta-detail texto-cortado" title="${v.tipoPago}" style="font-size:0.85em;">${v.tipoPago}</div>
                    <div class="venta-detail" style="text-align:center; font-weight:bold; color:${(v.factura || '').toUpperCase() === 'A' ? '#e74c3c' : '#3498db'};">${(v.factura || '-').toUpperCase()}</div>
                    <div class="celda-eliminar" style="display: flex; gap: 5px; justify-content: center;">
                        <button class="btn-eliminar-venta"
                                onclick="editarComentarioVenta(${v.id}, '${(v.comentarios || '').replace(/'/g, "\\'")}')"
                                title="${v.comentarios ? 'Editar comentario' : 'Agregar comentario'}"
                                style="background: ${v.comentarios ? '#3498db' : '#ecf0f1'}; color: ${v.comentarios ? 'white' : '#95a5a6'};">
                            💬
                        </button>
                        <button class="btn-eliminar-venta" onclick="borrarVenta(${v.id})">✕</button>
                    </div>
                </div>`;

                let filaComentario = '';
                if (v.comentarios && v.comentarios.trim() !== '') {
                    filaComentario = `
                        <div class="venta-comentario-row ${esParteDeGrupo ? 'grupo-venta' : ''}">
                            ↳ 💬 <strong>Nota:</strong> ${v.comentarios}
                        </div>
                    `;
                }

                return filaVenta + filaComentario;
            }

            // Renderizar grupos primero (ordenados por ID del primer elemento, descendente)
            const gruposOrdenados = Object.entries(grupos).sort((a, b) => {
                return b[1][0].id - a[1][0].id; // Más reciente primero
            });

            gruposOrdenados.forEach(([grupoId, ventas]) => {
                // Calcular total del grupo
                let totalGrupo = 0;
                ventas.forEach(v => {
                    const precioFinal = v.precio * (1 - (v.descuento || 0)/100);
                    const total = (v.cantidad === 0) ? precioFinal : (precioFinal * v.cantidad);
                    totalGrupo += total;
                });

                // Renderizar cada venta del grupo
                ventas.forEach((v, idx) => {
                    const esPrimero = idx === 0;
                    const esUltimo = idx === ventas.length - 1;
                    html += renderizarFilaVenta(v, true, esPrimero, esUltimo);
                });

                // Fila de total del grupo
                html += `
                    <div class="grupo-venta-total">
                        <div style="grid-column: 1 / 8; text-align: right; padding-right: 15px; color: #2c3e50;">
                            TOTAL VENTA (${ventas.length} art.):
                        </div>
                        <div style="text-align: right; font-weight: bold; font-size: 1.1em; color: #27ae60;">
                            ${formatMoney(totalGrupo)}
                        </div>
                        <div style="grid-column: 9 / 12;"></div>
                    </div>
                `;
            });

            // Renderizar ventas sin grupo
            ventasSinGrupo.forEach(v => {
                html += renderizarFilaVenta(v, false, false, false);
            });

html += `</div>`;
        }

        // 2. WIDGET MOVIMIENTOS (INTERMEDIO)
        html += `
            <div class="caja-movimientos-container">
                <div class="caja-movimientos-header">
                    <h4>📥 Registro de Movimientos (Caja Chica / Gastos)</h4>
                </div>
                
                <div class="caja-form">
                    <input type="text" id="movDetalle" placeholder="Detalle (ej: Pago Proveedor)" style="flex:2; padding:10px; border:1px solid #ddd; border-radius:6px;">
                    <input type="number" id="movMonto" placeholder="$ Monto" style="flex:1; padding:10px; border:1px solid #ddd; border-radius:6px;">
                    <button class="btn-movimiento btn-ingreso" onclick="registrarMovimientoCaja('${fecha}', 'ingreso')">➕ Ingreso</button>
                    <button class="btn-movimiento btn-egreso" onclick="registrarMovimientoCaja('${fecha}', 'egreso')">➖ Egreso</button>
                </div>

                <div class="movimientos-lista">
                    ${movimientos.length === 0 ? '<div style="font-size:0.9em; color:#999; font-style:italic;">No hay movimientos extras registrados.</div>' : ''}
                    ${movimientos.map(m => `
                        <div class="movimiento-row">
                            <div style="display:flex; align-items:center;">
                                <span class="mov-tipo ${m.tipo === 'ingreso' ? 'mov-ingreso' : 'mov-egreso'}">${m.tipo}</span>
                                <span>${m.detalle}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <strong style="color:${m.tipo === 'ingreso' ? '#155724' : '#721c24'}">
                                    ${formatMoney(m.monto)}
                                </strong>
                                <button onclick="editarMovimientoCaja(${m.id}, '${m.detalle.replace(/'/g, "\\'")}')" 
                    title="Editar detalle"
                    style="border:none; background:none; cursor:pointer; font-size: 1.1em;">
                ✎
            </button>
                                <button onclick="copiarMovimientoCC('${m.detalle.replace(/'/g, "\\'")}', ${m.monto}, '${m.tipo}', '${fecha}')" 
                            title="Crear en Cuenta Corriente"
                            style="border:none; background:none; cursor:pointer; font-size: 1.1em;">
                        👤
                    </button>
                                <button onclick="eliminarMovimientoCaja(${m.id}, '${fecha}')" style="border:none; background:none; cursor:pointer; color:#999;">&times;</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // IMPORTANTE: Guardamos el total de ventas en una variable global para usarla luego
        window.totalVentasCache = totalVentas;

        // 3. TOTALES FINALES (Box Oscuro)
        html += `
            <div class="total-final-card" style="background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
                <h3 style="margin-top:0; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:10px; margin-bottom:15px;">🏁 Cierre de Caja (Ventas)</h3>
                
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; align-items: center;">
                    <div>
                        <div style="opacity:0.8; font-size:0.9em;">(+) Caja Inicial</div>
                        <div id="displayCajaInicial" style="font-size:1.4em; font-weight:bold;">${formatMoney(montoCajaInicial)}</div>
                    </div>

                    <div>
                        <div style="opacity:0.8; font-size:0.9em;">(+) Ventas Totales</div>
                        <div style="font-size:1.4em; font-weight:bold; color:#2ecc71;">${formatMoney(totalVentas)}</div>
                    </div>

                    <div style="text-align:right; border-left:1px solid rgba(255,255,255,0.2); padding-left:20px;">
                        <div style="opacity:0.9; font-size:1em; margin-bottom:5px;">TOTAL VENTAS + CAJA</div>
                        <div id="displayTotalFinal" style="font-size:2.2em; font-weight:800; line-height:1;">${formatMoney(totalEnCaja)}</div>
                    </div>
                </div>

                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed rgba(255,255,255,0.3); display: flex; justify-content: space-between; align-items: center; font-size: 0.9em;">
                    <div style="opacity: 0.9;">
                        <strong>ℹ️ Movimientos Extra (No suman al total):</strong>
                    </div>
                    <div style="display: flex; gap: 20px;">
                        <span style="color: #a8e6cf;">⬆ Entradas: ${formatMoney(totalIngresos)}</span>
                        <span style="color: #ff8b8b;">⬇ Salidas: ${formatMoney(totalEgresos)}</span>
                        <span style="font-weight: bold; color: ${netoMovimientos >= 0 ? '#a8e6cf' : '#ff8b8b'};">
                            Balance: ${netoMovimientos > 0 ? '+' : ''}${formatMoney(netoMovimientos)}
                        </span>
                    </div>
                </div>

                <div style="margin-top:10px; font-size:0.8em; opacity:0.6; text-align:right;">
                    Fact. A: ${formatMoney(totalFacturaA)} | Fact. B: ${formatMoney(totalFacturaB)}
                </div>
            </div>
        `;

        lista.innerHTML = html;

    } catch (e) {
        console.error(e);
        lista.innerHTML = `<div class="alert alert-danger">Error cargando datos: ${e.message}</div>`;
    }
}

// ==================== NUEVAS FUNCIONES PARA LOS MOVIMIENTOS ====================

async function registrarMovimientoCaja(fecha, tipo) {
    const detalleInput = document.getElementById('movDetalle');
    const montoInput = document.getElementById('movMonto');
    
    const detalle = detalleInput.value.trim();
    const monto = parseFloat(montoInput.value);

    if (!detalle) {
        showToast('⚠️ Ingresá un detalle', 'error');
        return;
    }
    if (!monto || monto <= 0) {
        showToast('⚠️ Ingresá un monto válido', 'error');
        return;
    }

    try {
        const resp = await fetch('/api/caja/movimiento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha, tipo, monto, detalle })
        });

        if (resp.ok) {
            showToast(`✅ ${tipo === 'ingreso' ? 'Entrada' : 'Salida'} registrada`, 'success');
            cargarVentasDelDia(fecha); // Recargamos para ver cambios
        } else {
            throw new Error('Error al guardar');
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Error de conexión', 'error');
    }
}

async function eliminarMovimientoCaja(id, fecha) {
    if(!confirm('¿Eliminar este movimiento de caja?')) return;

    try {
        const resp = await fetch(`/api/caja/movimiento/${id}`, { method: 'DELETE' });
        if(resp.ok) {
            showToast('🗑️ Movimiento eliminado', 'success');
            cargarVentasDelDia(fecha);
        } else {
            showToast('❌ Error al eliminar', 'error');
        }
    } catch(e) {
        console.error(e);
        showToast('❌ Error de conexión', 'error');
    }
}

// ==================== CAJA INICIAL DEL DÍA ====================
let cajasIniciales = {}; // Cache local

async function cargarCajaInicial(fecha) {
    const input = document.getElementById('cajaInicial');
    if (!input) return;
    
    try {
        const response = await fetch(`/api/caja-inicial/${fecha}`);
        if (response.ok) {
            const data = await response.json();
            input.value = data.monto > 0 ? formatMonedaInput(data.monto) : '';
        } else {
            input.value = '';
        }
    } catch (e) {
        console.error('Error cargando caja inicial:', e);
        input.value = '';
    }
}

async function guardarCajaInicial() {
    if (!fechaSeleccionada) return;
    
    const input = document.getElementById('cajaInicial');
    
    // Obtenemos el número limpio
    const valorStr = input.value.replace(/[^\d]/g, '');
    const monto = parseInt(valorStr) || 0;
    
    // Feedback visual pequeño (opacidad)
    input.style.opacity = "0.5";

    try {
        const response = await fetch('/api/caja-inicial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha: fechaSeleccionada, monto })
        });
        
        input.style.opacity = "1";

        if (response.ok) {
            showToast('Caja inicial guardada', 'success');
            
            // === AQUÍ ESTÁ LA MAGIA ===
            
            // 1. Actualizamos el número de Caja Inicial abajo
            const displayCaja = document.getElementById('displayCajaInicial');
            if (displayCaja) {
                displayCaja.textContent = formatMoney(monto);
            }

            // 2. Actualizamos el Total Gigante (Ventas + Nueva Caja)
            // Usamos la variable window.totalVentasCache que guardamos en el Paso 1
            const totalVentas = window.totalVentasCache || 0; 
            const nuevoTotal = totalVentas + monto;
            
            const displayTotal = document.getElementById('displayTotalFinal');
            if (displayTotal) {
                displayTotal.textContent = formatMoney(nuevoTotal);
            }

        } else {
            showToast('Error al guardar caja', 'error');
        }
    } catch (e) {
        input.style.opacity = "1";
        console.error('Error guardando caja inicial:', e);
        showToast('Error de conexión', 'error');
    }
}

function formatearInputMoneda(input) {
    let valor = input.value.replace(/[^\d]/g, '');
    if (valor) {
        valor = parseInt(valor).toLocaleString('es-AR');
        input.value = '$' + valor;
    }
}

function formatMonedaInput(monto) {
    return '$' + Math.round(monto).toLocaleString('es-AR');
}

    // ==================== CARGAR VENTAS ====================
    async function cargarVentas() {
    try {
        const response = await fetch('/api/ventas');
        const ventas = await response.json();
        
        const lista = document.getElementById('listaVentas');
        if (ventas.length === 0) {
            lista.innerHTML = '<p style="color: #999;">No hay ventas registradas</p>';
            return;
        }

        let totalDia = 0;

        lista.innerHTML = ventas.map(v => {
            const precioFinal = v.precio * (1 - v.descuento / 100);
            const total = precioFinal * v.cantidad;
            totalDia += total;
            
            return `
                <div class="venta-item">
                    <button class="btn-eliminar-venta" onclick="borrarVenta(${v.id})" title="Eliminar venta">✕</button>
                    <div class="venta-detail"><strong>Fecha</strong> ${v.fecha}</div>
                    <div class="venta-detail"><strong>Artículo</strong> ${v.articulo}</div>
                    <div class="venta-detail"><strong>Cantidad</strong> ${v.cantidad}</div>
                    <div class="venta-detail"><strong>Precio Unit.</strong> ${formatMoney(precioFinal)} ${v.descuento > 0 ? `(-${v.descuento}%)` : ''}</div>
                    <div class="venta-detail"><strong>Total</strong> ${formatMoney(total)}</div>
                    <div class="venta-detail"><strong>Categoría</strong> ${v.categoria}</div>
                    <div class="venta-detail"><strong>Factura</strong> ${v.factura}</div>
                    <div class="venta-detail"><strong>Pago</strong> ${v.tipoPago}</div>
                    ${v.comentarios ? `
                        <div class="venta-comentario">
                            <strong>💬 Comentario:</strong> ${v.comentarios}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Agregar total del día
        lista.innerHTML += `
            <div style="background: linear-gradient(135deg, #28a745 0%, #20923c 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 20px; text-align: right;">
                <div style="font-size: 1.1em; margin-bottom: 8px;">Total del Día</div>
                <div style="font-size: 2.2em; font-weight: 700;">${formatMoney(totalDia)}</div>
                <div style="font-size: 0.95em; opacity: 0.9; margin-top: 5px;">${ventas.length} venta${ventas.length !== 1 ? 's' : ''}</div>
            </div>
        `;
    } catch (error) {
        console.error('Error cargando ventas:', error);
    }
}

    // ==================== 3. UPLOAD CSV ====================
    async function uploadCSV() {
        const fileInput = document.getElementById('csvFile');
        const file = fileInput.files[0];
        if (!file) return;

        // Obtener el modo seleccionado (replace o add)
        const modo = document.querySelector('input[name="modoStock"]:checked').value;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('modo', modo); // Enviamos la elección al servidor

        // Feedback visual inmediato
        const uploadArea = fileInput.parentElement;
        const textoOriginal = uploadArea.innerHTML;
        uploadArea.innerHTML = '<div class="icon">⏳</div><p>Procesando...</p>';

        try {
            const response = await fetch('/api/stock/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            let mensaje = `✅ ${result.procesados} productos actualizados (${modo === 'add' ? 'Sumados' : 'Reemplazados'})`;
            if (result.errores && result.errores.length > 0) {
                mensaje += ` (${result.errores.length} errores)`;
            }

            showAlert('alertaStock', mensaje, 'success');

            if (result.errores && result.errores.length > 0) {
                const errorHTML = result.errores.map(e => `${e.codigo}: ${e.error}`).join('<br>');
                document.getElementById('resultadoStock').innerHTML = `<div class="alert alert-warning show"><strong>Errores:</strong><br>${errorHTML}</div>`;
            } else {
                document.getElementById('resultadoStock').innerHTML = '';
            }

            // Recargar la tabla para ver los cambios
            cargarStockCompleto();

        } catch (error) {
            showAlert('alertaStock', `❌ ${error.message}`, 'danger');
        } finally {
            // Restaurar el input y el área de carga
            fileInput.value = '';
            uploadArea.innerHTML = textoOriginal;
        }
    }

    // ==================== IMPORTAR PRODUCTOS COMPLETOS ====================
    async function importarProductosCSV() {
        const file = document.getElementById('csvProductos').files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/productos/importar', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.ok) {
                showAlert('alertaProductos', `✅ ${result.importados} productos importados` + (result.omitidos > 0 ? ` (${result.omitidos} omitidos)` : ''), 'success');
                cargarStockCompleto(); // Recargar la tabla
            } else {
                showAlert('alertaProductos', `❌ ${result.error}`, 'danger');
            }

            document.getElementById('csvProductos').value = '';
        } catch (error) {
            showAlert('alertaProductos', `❌ ${error.message}`, 'danger');
        }
    }

    // ==================== STOCK: BUSCAR Y EDITAR PRODUCTO ====================
let productoStockActual = null;

document.getElementById('stockBusquedaCodigo')?.addEventListener('keyup', async (e) => {
    const busqueda = e.target.value.trim();
    const resultado = document.getElementById('stockBusquedaResultado');
    const editor = document.getElementById('stockEditor');

    if (busqueda.length < 2) {
        resultado.style.display = busqueda.length === 1 ? 'block' : 'none';
        resultado.innerHTML = busqueda.length === 1 ? '<span style="color:#999;">Escribí al menos 2 caracteres...</span>' : '';
        editor.style.display = 'none';
        productoStockActual = null;
        return;
    }

    try {
        const response = await fetch(`/api/productos/buscar?q=${encodeURIComponent(busqueda)}`);
        if (!response.ok) {
            resultado.style.display = 'block';
            // En lugar de solo texto, ponemos el BOTÓN
            resultado.innerHTML = `
                <div style="padding: 10px; text-align: center;">
                    <p style="color: #e74c3c; margin-bottom: 10px;">❌ No se encontró el producto "${busqueda}"</p>
                    <button onclick="abrirModalProducto('${busqueda}')" style="background: #27ae60; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;">
                        ✨ Crear Artículo: ${busqueda.toUpperCase()}
                    </button>
                </div>
            `;
            editor.style.display = 'none';
            productoStockActual = null;
            return;
        }

        const data = await response.json();
        
        // Si hay múltiples resultados
        if (data.multiple) {
            resultado.style.display = 'block';
            resultado.innerHTML = `
                <div class="resultados-lista" style="max-height: 250px;">
                    ${data.productos.map(p => `
                        <div class="resultado-item" onclick="seleccionarProductoStock(${JSON.stringify(p).replace(/"/g, '&quot;')})">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${p.codigo}</strong> - ${p.descripcion}
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-weight: bold; color: var(--primary);">${formatMoney(p.precioPublico || 0)}</span>
                                    <span style="font-size: 0.85em; color: ${(p.stock || 0) <= 0 ? '#d9534f' : '#5cb85c'}; margin-left: 10px;">Stock: ${p.stock || 0}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            editor.style.display = 'none';
            productoStockActual = null;
        } else {
            // Un solo resultado - mostrar editor
            mostrarEditorStock(data);
        }
    } catch (error) {
        resultado.style.display = 'block';
        resultado.innerHTML = '⚠️ Error: ' + error.message;
        editor.style.display = 'none';
        productoStockActual = null;
    }
});

function seleccionarProductoStock(producto) {
    mostrarEditorStock(producto);
}

function mostrarEditorStock(producto) {
    const resultado = document.getElementById('stockBusquedaResultado');
    const editor = document.getElementById('stockEditor');
    
    productoStockActual = producto;
    resultado.style.display = 'none';
    resultado.innerHTML = '';

    // Llenar editor
    document.getElementById('stockProductoTitulo').textContent = producto.descripcion || '';
    document.getElementById('stockCodigo').textContent = producto.codigo || '';
    document.getElementById('stockCategoria').textContent = producto.categoria || '';
    document.getElementById('stockPrecioPublico').value = producto.precioPublico || 0;
    document.getElementById('stockCosto').value = producto.costo || 0;
    document.getElementById('stockActual').textContent = producto.stock ?? 0;
    document.getElementById('stockDelta').value = 0;
    document.getElementById('stockFinal').textContent = producto.stock ?? 0;

    document.getElementById('stockEditorMensaje').style.display = 'none';
    editor.style.display = 'block';
}

// Recalcular stock final cuando cambia delta
document.getElementById('stockDelta')?.addEventListener('input', () => {
    if (!productoStockActual) return;
    const actual = Number(productoStockActual.stock) || 0;
    const delta = parseInt(document.getElementById('stockDelta').value) || 0;
    const final = actual + delta;
    document.getElementById('stockFinal').textContent = final;
});

// ==================== STOCK: GUARDAR CAMBIOS ====================
async function guardarStockYPrecios(event) {
    const btnGuardar = event?.target;
    const textoOriginal = btnGuardar?.innerHTML;
    
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = 'Guardando... <span class="loading-spinner"></span>';
    }
    
    try {
        if (!productoStockActual) return;

        const mensaje = document.getElementById('stockEditorMensaje');
        mensaje.style.display = 'none';
        mensaje.style.color = '#a94442';
        mensaje.textContent = '';

        const codigo = productoStockActual.codigo;
        const precioPublico = parseFloat(document.getElementById('stockPrecioPublico').value) || 0;
        const costo = parseFloat(document.getElementById('stockCosto').value) || 0;
        const stockActual = Number(productoStockActual.stock) || 0;
        const delta = parseInt(document.getElementById('stockDelta').value) || 0;
        const stockFinal = stockActual + delta;

        if (stockFinal < 0) {
            mensaje.style.display = 'block';
            mensaje.textContent = '⚠️ El stock final no puede ser negativo';
            return;
        }

        const response = await fetch(`/api/productos/${encodeURIComponent(codigo)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ precioPublico, costo, stockFinal })
        });

        if (!response.ok) {
            let errorText = 'desconocido';
            try {
                const error = await response.json();
                errorText = error.error || errorText;
            } catch (_) {}
            mensaje.style.display = 'none';
            showToast('Error al guardar: ' + errorText, 'error');
            return;
        }

        productoStockActual.precioPublico = precioPublico;
        productoStockActual.costo = costo;
        productoStockActual.stock = stockFinal;

        document.getElementById('stockActual').textContent = stockFinal;
        document.getElementById('stockDelta').value = 0;
        document.getElementById('stockFinal').textContent = stockFinal;

        mensaje.style.display = 'none';
        showToast('Cambios guardados correctamente', 'success');

    } catch (error) {
        const mensaje = document.getElementById('stockEditorMensaje');
        mensaje.style.display = 'none';
        showToast('Error: ' + error.message, 'error');
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = textoOriginal || 'Guardar Cambios';
        }
    }
}

// ==================== STOCK: LISTADO Y RESUMEN ====================
let productosCache = [];

async function cargarStockCompleto() {
    try {
        const resp = await fetch('/api/productos');
        const productos = await resp.json();
        productosCache = productos || [];

        renderStockResumen();
        renderStockTabla();
        llenarFiltroCategorias();
    } catch (error) {
        console.error('Error cargando productos:', error);
    }
}

function renderStockResumen() {
    const totalEl = document.getElementById('stockResumenTotal');
    const cont = document.getElementById('stockResumen');
    if (!totalEl || !cont) return;

    let totalPrendas = 0;
    const porCategoria = {};

    productosCache.forEach(p => {
        const stock = Number(p.stock) || 0;
        totalPrendas += stock;
        const cat = p.categoria || 'Sin categoría';
        porCategoria[cat] = (porCategoria[cat] || 0) + stock;
    });

    // Box superior derecho: PRENDAS TOTALES: X (Y artículos)
    totalEl.innerHTML = `
        <span class="stock-resumen-total-label">PRENDAS TOTALES -</span>
        <span class="stock-resumen-total-value">${totalPrendas}</span>
        <span style="font-size:0.78em; opacity:0.9;">(${productosCache.length} artículos)</span>
    `;

    // Tarjetas clickeables por categoría
    let html = '';
    Object.entries(porCategoria).forEach(([cat, stock]) => {
        const safeCat = cat.replace(/"/g, '&quot;');
        html += `
            <div class="stock-resumen-item" onclick="filtrarPorCategoria('${safeCat}')">
                <h4>${cat}</h4>
                <div class="valor">${stock}</div>
            </div>
        `;
    });

    cont.innerHTML = html;
}


function filtrarPorCategoria(cat) {
    const select = document.getElementById('filtroCategoria');
    if (!select) return;
    select.value = cat === 'Sin categoría' ? '' : cat;
    renderStockTabla();
    // scroll suave hasta la tabla
    document.querySelector('.stock-tabla-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


function llenarFiltroCategorias() {
    const select = document.getElementById('filtroCategoria');
    if (!select) return;

    const categorias = new Set();
    productosCache.forEach(p => {
        if (p.categoria) categorias.add(p.categoria);
    });

    const valorActual = select.value || '';
    select.innerHTML = '<option value="">Todas las categorías</option>' +
        Array.from(categorias).sort().map(c => `<option value="${c}">${c}</option>`).join('');
    select.value = valorActual;
}

function renderStockTabla() {
    const tbody = document.getElementById('stockTablaBody');
    if (!tbody) return;

    const catFiltro = document.getElementById('filtroCategoria')?.value || '';
    const texto = (document.getElementById('filtroTexto')?.value || '').toLowerCase().trim();

    const filtrados = productosCache.filter(p => {
        if (catFiltro && p.categoria !== catFiltro) return false;
        if (!texto) return true;
        return (p.descripcion || '').toLowerCase().includes(texto) ||
               (p.codigo || '').toLowerCase().includes(texto);
    });

    if (filtrados.length === 0) {
        if (texto.length > 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 30px;">
                        <p style="color: #666; margin-bottom: 15px;">No se encontró "<strong>${texto}</strong>"</p>
                        <button onclick="abrirModalProducto('${texto}')" style="background: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">
                            ✨ Agregar Nuevo: ${texto.toUpperCase()}
                        </button>
                    </td>
                </tr>`;
        } else {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#9ca3af; padding:12px;">Sin resultados</td></tr>`;
        }
        return;
    }

    tbody.innerHTML = filtrados.map(p => `
        <tr>
            <td><strong>${p.codigo}</strong></td>
            <td>${p.descripcion || ''}</td>
            <td>${p.categoria || ''}</td>
            <td class="num">${formatMoney(p.precioPublico || 0)}</td>
            <td class="num" style="color:#888;">${formatMoney(p.costo || 0)}</td>
            
            <td class="stock-editable num" onclick="editarStock(this, '${p.codigo}')" title="Click para editar" style="cursor: pointer;">
                ${p.stock ?? 0}
            </td>

            <td style="text-align: center; width: 50px;">
                <button onclick="eliminarProducto('${p.codigo}', '${p.descripcion}')" 
                        style="background: transparent; border: none; color: #e74c3c; cursor: pointer; font-size: 1.1em; padding: 5px;" 
                        title="Eliminar producto">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
}

// Filtros en tiempo real
document.getElementById('filtroCategoria')?.addEventListener('change', renderStockTabla);
document.getElementById('filtroTexto')?.addEventListener('input', renderStockTabla);


    // ==================== 4. CUENTAS CORRIENTES ====================
async function crearCuenta() {
    const cliente = document.getElementById('cuentasCliente').value.trim();
    const telefono = document.getElementById('cuentasTelefono').value.trim(); // NUEVO

    if (!cliente) {
        showToast('⚠️ Ingresa el nombre del cliente', 'error');
        return;
    }

    try {
        const response = await fetch('/api/cuentas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente, telefono }) // Enviamos teléfono
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Error al crear cuenta');

        showToast('✅ Cuenta creada correctamente', 'success');
        document.getElementById('cuentasCliente').value = '';
        document.getElementById('cuentasTelefono').value = ''; // Limpiar
        cargarCuentas();
    } catch (error) {
        console.error('Error en crearCuenta:', error);
        showToast(`❌ ${error.message}`, 'error');
    }
}

// Mini tabs de cuentas
function switchCuentasTab(tab, event) {
    document.querySelectorAll('.mini-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.cuentas-tab-content').forEach(tc => tc.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tab === 'activas' ? 'cuentasActivas' : 'cuentasSaldadas').classList.add('active');
}

// Toggle para mostrar/ocultar historial
function toggleHistorial(clienteId) {
    const content = document.getElementById(`historial-${clienteId}`);
    const button = event.target.closest('.historial-toggle');
    
    content.classList.toggle('open');
    button.classList.toggle('open');
}


async function agregarMovimiento(cliente, tipo) {
    const clienteId = cliente.replace(/\s/g, '-');
    const inputMontoId = `${tipo}-${clienteId}`;
    const inputFechaId = `fecha-${tipo}-${clienteId}`;
    const inputComentarioId = `comentario-${tipo}-${clienteId}`;
    
    const monto = parseFloat(document.getElementById(inputMontoId).value);
    const fecha = document.getElementById(inputFechaId).value;
    const comentario = document.getElementById(inputComentarioId).value.trim();

    if (!monto || monto <= 0) {
        showToast('⚠️ Ingresa un monto válido', 'error');
        return;
    }

    if (!fecha) {
        showToast('⚠️ Selecciona una fecha', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/cuentas/${encodeURIComponent(cliente)}/movimiento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, monto, fecha, comentario })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al agregar movimiento');
        }

        showToast(`✅ ${tipo === 'deuda' ? 'Deuda' : 'Pago'} registrado correctamente`, 'success');
        document.getElementById(inputMontoId).value = '';
        document.getElementById(inputComentarioId).value = '';
        cargarCuentas();
    } catch (error) {
        console.error('Error en agregarMovimiento:', error);
        showToast(`❌ ${error.message}`, 'error');
    }
}

async function cargarCuentas() {
    try {
        const response = await fetch('/api/cuentas');
        const cuentas = await response.json();

        const gridActivas = document.getElementById('cuentasGridActivas');
        const gridSaldadas = document.getElementById('cuentasGridSaldadas');

        // LOADING INDICATOR
    if (gridActivas) {
        gridActivas.innerHTML = '<div style="text-align:center; padding:30px; color:#666;"><span class="loading-spinner"></span> Cargando cuentas...</div>';
    }
    if (gridSaldadas) {
        gridSaldadas.innerHTML = '';
    }

        if (!cuentas || cuentas.length === 0) {
            gridActivas.innerHTML = `<div class="empty-state"><p>📭 Sin cuentas registradas</p></div>`;
            gridSaldadas.innerHTML = '';
            document.getElementById('totalesCuentas').innerHTML = '';
            return;
        }

        const hoy = new Date().toISOString().split('T')[0];
        let totalDeuda = 0;
        let totalPagos = 0;

        // Para cada cuenta, traemos sus movimientos para saber si tiene historial
        const cuentasConMovimientos = await Promise.all(
            cuentas.map(async (c) => {
                const movResponse = await fetch(`/api/cuentas/${encodeURIComponent(c.cliente)}/movimientos`);
                const movimientos = await movResponse.json();
                return { ...c, movimientos };
            })
        );

        // Separar activas y saldadas según saldo + movimientos
        const activas = [];
        const saldadas = [];

        cuentasConMovimientos.forEach(c => {
            const saldo = c.deuda - c.pagos;
            const tieneMovimientos = c.movimientos && c.movimientos.length > 0;

            if (saldo !== 0) {
                activas.push(c);
            } else if (tieneMovimientos) {
                saldadas.push(c);
            } else {
                // saldo 0 y sin movimientos → recién creada → activa
                activas.push(c);
            }
        });

        // Función para generar el HTML de una cuenta (usamos los movimientos ya cargados)
        const generarCuentaHTML = (c) => {
            const saldo = c.deuda - c.pagos;
            totalDeuda += c.deuda;
            totalPagos += c.pagos;

            const clienteId = c.cliente.replace(/\s/g, '-');
            const movimientos = c.movimientos || [];

            const historialHTML = movimientos.length > 0 ? `
                <div class="cuenta-historial">
                    <button class="historial-toggle" onclick="toggleHistorial('${clienteId}')">
                        <span>📋 Historial de Movimientos (${movimientos.length})</span>
                        <span class="arrow">▼</span>
                    </button>
                    <div class="historial-content" id="historial-${clienteId}">
                        ${movimientos.map(m => `
                            <div class="movimiento-item ${m.tipo}">
                                <div class="movimiento-header">
                                    <span class="movimiento-tipo ${m.tipo}">
                                        ${m.tipo === 'deuda' ? '📈 Deuda' : '💰 A Favor'}
                                    </span>
                                    <span class="movimiento-monto">${formatMoney(m.monto)}</span>
                                    <button onclick="editarMovimientoCuenta(${m.id}, '${(m.comentario || '').replace(/'/g, "\\'")}')"
                    title="Editar comentario"
                    style="border:none; background:none; cursor:pointer; color:#666;">
                ✎
            </button>
                                </div>
                                <div class="movimiento-fecha">📅 ${m.fecha}</div>
                                ${m.comentario ? `<div class="movimiento-comentario">💬 ${m.comentario}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : '';

            return `
                <div class="cuenta-box" style="position: relative;">
                    <button class="btn-eliminar-cuenta" onclick="eliminarCuenta('${c.cliente}')" title="Eliminar cuenta">✕</button>
                    
                    <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; padding-right: 40px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 5px;">
                            <h3 style="margin: 0; color: #007bff; font-size: 1.25em;">👤 ${c.cliente}</h3>
                            ${c.telefono ? `<span style="background: #eef; color: #449; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 600; white-space: nowrap;">📞 ${c.telefono}</span>` : ''}
                        </div>
                        ${c.articulo ? `<div style="color: #888; font-size: 0.85em; margin-top: 5px; font-style: italic;">🛍️ ${c.articulo}</div>` : ''}
                    </div>

                    <div class="cuenta-saldo">
                        <div class="cuenta-valor">
                            <label>Deuda</label>
                            <div class="monto" style="color: #d9534f;">${formatMoney(c.deuda)}</div>
                        </div>
                        <div class="cuenta-valor">
                            <label>A Favor</label>
                            <div class="monto" style="color: #27ae60;">${formatMoney(c.pagos)}</div>
                        </div>
                        <div class="cuenta-valor">
                            <label>Saldo Final</label>
                            <div class="monto" style="color: ${saldo > 0 ? '#d9534f' : saldo < 0 ? '#27ae60' : '#333'}; font-size: 1.1em;">
                                ${saldo > 0 ? 'Debe' : saldo < 0 ? 'A favor' : 'Al día'} <br>
                                ${formatMoney(Math.abs(saldo))}
                            </div>
                        </div>
                    </div>

                    <div class="cuenta-acciones">
                         <div style="display: flex; flex-direction: column; gap: 5px;">
                            <input type="date" id="fecha-deuda-${clienteId}" value="${hoy}" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                            <input type="text" id="comentario-deuda-${clienteId}" placeholder="Detalle deuda" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                            <div class="cuenta-input-group">
                                <input type="number" id="deuda-${clienteId}" placeholder="$ Monto" min="0" step="0.01">
                                <button class="btn-cuenta deuda" onclick="agregarMovimiento('${c.cliente}', 'deuda')">+ Deuda</button>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <input type="date" id="fecha-pago-${clienteId}" value="${hoy}" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                            <input type="text" id="comentario-pago-${clienteId}" placeholder="Detalle a favor" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                            <div class="cuenta-input-group">
                                <input type="number" id="pago-${clienteId}" placeholder="$ Monto" min="0" step="0.01">
                                <button class="btn-cuenta pago" onclick="agregarMovimiento('${c.cliente}', 'pago')">+ A Favor</button>
                            </div>
                        </div>
                    </div>
                    ${historialHTML}
                </div>
            `;
        };

        // Renderizar activas
        if (activas.length > 0) {
            gridActivas.innerHTML = `<div class="cuentas-grid">` + activas.map(generarCuentaHTML).join('') + `</div>`;
        } else {
            gridActivas.innerHTML = `<div class="empty-state"><p>✅ No hay cuentas activas</p></div>`;
        }

        // Renderizar saldadas
        if (saldadas.length > 0) {
            gridSaldadas.innerHTML = `<div class="cuentas-grid">` + saldadas.map(generarCuentaHTML).join('') + `</div>`;
        } else {
            gridSaldadas.innerHTML = `<div class="empty-state"><p>📭 No hay cuentas saldadas</p></div>`;
        }

        // Totales generales (se siguen calculando con todas)
        const saldoTotal = totalDeuda - totalPagos;
        document.getElementById('totalesCuentas').innerHTML = `
            <div style="background: linear-gradient(135deg, ${saldoTotal > 0 ? '#d9534f' : '#5cb85c'} 0%, ${saldoTotal > 0 ? '#c9302c' : '#4cae4c'} 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 20px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
                    <div>
                        <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">Total Deuda</div>
                        <div style="font-size: 1.8em; font-weight: 700;">${formatMoney(totalDeuda)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">Total Pagos</div>
                        <div style="font-size: 1.8em; font-weight: 700;">${formatMoney(totalPagos)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 5px;">Saldo Total</div>
                        <div style="font-size: 2.2em; font-weight: 700;">${formatMoney(saldoTotal)}</div>
                    </div>
                </div>
                <div style="text-align: center; font-size: 0.9em; opacity: 0.9; margin-top: 15px;">
                    ${activas.length} activa${activas.length !== 1 ? 's' : ''} · ${saldadas.length} saldada${saldadas.length !== 1 ? 's' : ''}
                </div>
            </div>
        `;
    } catch (error) {
        document.getElementById('cuentasGridActivas').innerHTML = `<div class="alert alert-danger show">Error: ${error.message}</div>`;
    }
}


// ==================== ELIMINAR CUENTA ====================
async function eliminarCuenta(cliente) {
    if (!confirm(`¿Estás seguro de eliminar la cuenta de "${cliente}"?\n\nSe borrarán todos los movimientos y no se puede deshacer.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/cuentas/${encodeURIComponent(cliente)}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            showToast('✅ Cuenta eliminada correctamente', 'success');
            cargarCuentas();
        } else {
            showToast(`❌ ${data.error || 'Error al eliminar cuenta'}`, 'error');
        }
    } catch (error) {
        console.error('Error en eliminarCuenta:', error);
        showToast(`❌ Error de conexión: ${error.message}`, 'error');
    }
}


    // ==================== INICIALIZACIÓN ====================
window.addEventListener('load', () => {
    cargarVentasDelMes();
    cargarStockCompleto();
    initHistorico();
    initComparativa();
    initPromedios();
});


    // ==================== DRAG & DROP PARA CSV ====================
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.style.background = '#e8f4f8';
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.style.background = '';
            });
        });

        uploadArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            document.getElementById('csvFile').files = files;
            uploadCSV();
        });
    }

    // ==================== FUNCION PARA EL TOAST ====================
    function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.className = 'toast ' + (type === 'success' ? 'toast-success' : 'toast-error');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== HISTÓRICO DE VENTAS ====================
let historicoVentas = [];
let ventasFiltradas = [];

function initHistorico() {
    const anioSelect = document.getElementById('historicoAnio');
    if (!anioSelect) return;

    const hoy = new Date();
    const anioActual = hoy.getFullYear();

    // Rango de años
    for (let y = anioActual; y >= 2023; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        anioSelect.appendChild(opt);
    }
    anioSelect.value = anioActual;

    // Meses
    const mesesCont = document.getElementById('historicoMeses');
    const nombresMes = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const mesActual = hoy.getMonth() + 1;

    for (let m = 1; m <= 12; m++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mes-pill' + (m === mesActual ? ' selected' : '');
        btn.dataset.mes = m;
        btn.textContent = nombresMes[m - 1];
        btn.addEventListener('click', () => toggleMesSeleccionado(m));
        mesesCont.appendChild(btn);
    }

    anioSelect.addEventListener('change', cargarHistorico);
    cargarHistorico();
}

function getMesesSeleccionados() {
    return Array.from(document.querySelectorAll('.mes-pill.selected'))
        .map(el => parseInt(el.dataset.mes));
}

function toggleMesSeleccionado(mes) {
    const el = document.querySelector(`.mes-pill[data-mes="${mes}"]`);
    if (!el) return;
    el.classList.toggle('selected');

    const seleccionados = getMesesSeleccionados();
    if (seleccionados.length === 0) {
        el.classList.add('selected');
        return;
    }
    cargarHistorico();
}

async function cargarHistorico() {
    const anio = document.getElementById('historicoAnio').value;
    const meses = getMesesSeleccionados();
    if (!anio || meses.length === 0) return;

    try {
        const resp = await fetch(`/api/ventas/historico?anio=${anio}&meses=${meses.join(',')}`);
        historicoVentas = await resp.json();
        ventasFiltradas = [];
        renderHistorico(anio, meses);
        
        // CORRECCIÓN: Solo actualizar gráficos si la sección YA está visible.
        // Nunca forzar la apertura automática.
        /*const seccion = document.getElementById('seccionGraficos');
        if (seccion && seccion.style.display === 'block') {
            generarGraficos();
        } */

        // Siempre regenerar gráficos porque ahora está abierto por default
        generarGraficos();

    } catch (err) {
        console.error('Error histórico:', err);
    }
}


function renderHistorico(anio, meses) {
    const periodoLabel = document.getElementById('histPeriodoLabel');
    const nombresMesLargos = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    // 1. Actualizar título del período
    if (meses.length === 1) {
        periodoLabel.textContent = `${nombresMesLargos[meses[0]-1]} ${anio}`;
    } else {
        const primero = nombresMesLargos[meses[0]-1];
        const ultimo = nombresMesLargos[meses[meses.length-1]-1];
        periodoLabel.textContent = `${primero} – ${ultimo} ${anio}`;
    }

    // 2. Calcular Métricas Generales
    let totalVentas = 0;
    let totalPrendas = 0;
    let facturaACant = 0;
    let facturaAMonto = 0;
    let facturaBCant = 0;
    let facturaBMonto = 0;

    historicoVentas.forEach(v => {
        const precioFinal = v.precio * (1 - (v.descuento || 0)/100);
        const total = precioFinal * v.cantidad;
        totalVentas += total;
        totalPrendas += v.cantidad;
        
        // Contar facturas y sumar montos
        const tipoFactura = (v.factura || '').toUpperCase().trim();
        if (tipoFactura === 'A') {
            facturaACant++;
            facturaAMonto += total;
        } else if (tipoFactura === 'B') {
            facturaBCant++;
            facturaBMonto += total;
        }
    });

    const totalTickets = historicoVentas.length;
    const ticketPromedio = totalTickets ? totalVentas / totalTickets : 0;

    // 3. Renderizar Métricas en el DOM
    document.getElementById('histTotalVentas').textContent = formatMoney(totalVentas);
    document.getElementById('histTotalTickets').textContent = `${totalTickets} tickets`;
    document.getElementById('histPrendasVendidas').textContent = totalPrendas;
    document.getElementById('histTicketPromedio').textContent = formatMoney(ticketPromedio);
    
    // Facturación A y B
    document.getElementById('histFacturaAMonto').textContent = formatMoney(facturaAMonto);
    document.getElementById('histFacturaACant').textContent = `${facturaACant} tickets`;
    document.getElementById('histFacturaBMonto').textContent = formatMoney(facturaBMonto);
    document.getElementById('histFacturaBCant').textContent = `${facturaBCant} tickets`;

    // 4. Renderizar Tabla de Ventas
    const tbody = document.getElementById('histVentasBody');
    
    if (!historicoVentas.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#9ca3af; padding:20px;">Sin ventas en este período</td></tr>`;
        // IMPORTANTE: No hacemos 'return' acá para que el código siga y limpie los filtros abajo
    } else {
        tbody.innerHTML = historicoVentas.map(v => {
            const precioUnitario = v.precio;
            const precioConDescuento = v.precio * (1 - (v.descuento || 0)/100);
            const total = precioConDescuento * v.cantidad;
            
            const precioDisplay = formatMoney(precioUnitario);
            const facturaDisplay = v.factura || '-';
            const facturaColor = v.factura === 'A' ? '#3498db' : v.factura === 'B' ? '#e67e22' : '#999';

            return `
                <tr>
                    <td>${v.fecha}</td>
                    <td>${v.codigoArticulo}</td>
                    <td>${v.categoria || ''}</td>
                    <td class="num">${v.cantidad}</td>
                    <td class="num">${precioDisplay}</td>
                    <td class="num">${v.descuento ? v.descuento + '%' : '-'}</td>
                    <td class="num">${formatMoney(total)}</td>
                    <td>${v.tipoPago || '-'}</td>
                    <td style="color: ${facturaColor}; font-weight: bold;">${facturaDisplay}</td>
                </tr>
            `;
        }).join('');
    }

    // 5. ACTUALIZAR FILTROS (Nueva línea clave)
    // Esto asegura que el desplegable de categorías se llene con los datos recién cargados
    cargarOpcionesFiltros(); 
}

// ==================== FILTROS DE TABLA ====================
function toggleFiltrosTabla() {
    const panel = document.getElementById('filtrosTablaPanel');
    const btn = document.getElementById('btnFiltrosTabla');
    
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        btn.innerHTML = '<span class="icono">🔍</span> Ocultar filtros';
        cargarOpcionesFiltros();
    } else {
        panel.style.display = 'none';
        btn.innerHTML = '<span class="icono">🔍</span> Filtros';
    }
}

function cargarOpcionesFiltros() {
    // Usamos los NUEVOS IDs únicos
    const selectCat = document.getElementById('histFiltroCategoria');
    const selectPago = document.getElementById('histFiltroTipoPago');
    
    if (!selectCat || !selectPago) return;

    // 1. Obtener datos únicos
    const categorias = [...new Set(historicoVentas.map(v => v.categoria).filter(c => c))].sort();
    const tiposPago = [...new Set(historicoVentas.map(v => v.tipoPago).filter(t => t))].sort();

    // 2. Guardar selección actual
    const catSeleccionada = selectCat.value;
    const pagoSeleccionado = selectPago.value;

    // 3. Llenar HTML
    selectCat.innerHTML = '<option value="">Todas</option>' + 
        categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');

    selectPago.innerHTML = '<option value="">Todos</option>' + 
        tiposPago.map(tipo => `<option value="${tipo}">${tipo}</option>`).join('');

    // 4. Restaurar selección
    if (categorias.includes(catSeleccionada)) selectCat.value = catSeleccionada;
    if (tiposPago.includes(pagoSeleccionado)) selectPago.value = pagoSeleccionado;
}

function aplicarFiltrosTabla() {
    // Leemos de los NUEVOS IDs
    const articulo = document.getElementById('histFiltroArticulo').value.toLowerCase();
    const categoria = document.getElementById('histFiltroCategoria').value;
    const tipoPago = document.getElementById('histFiltroTipoPago').value;
    const montoMin = parseFloat(document.getElementById('histFiltroMontoMin').value) || 0;
    const montoMax = parseFloat(document.getElementById('histFiltroMontoMax').value) || Infinity;
    const cantidadMin = parseInt(document.getElementById('histFiltroCantidadMin').value) || 0;

    ventasFiltradas = historicoVentas.filter(v => {
        const precioFinal = v.precio * (1 - (v.descuento || 0)/100);
        const total = precioFinal * v.cantidad;
        
        const matchArticulo = !articulo || 
            (v.codigoArticulo && v.codigoArticulo.toLowerCase().includes(articulo));
        const matchCategoria = !categoria || v.categoria === categoria;
        const matchTipoPago = !tipoPago || v.tipoPago === tipoPago;
        const matchMonto = total >= montoMin && total <= montoMax;
        const matchCantidad = v.cantidad >= cantidadMin;

        return matchArticulo && matchCategoria && matchTipoPago && matchMonto && matchCantidad;
    });

    renderTablaFiltrada();
    
    // Actualizar contador
    const label = document.getElementById('filtrosResultado');
    if (label) {
        label.textContent = `${ventasFiltradas.length} de ${historicoVentas.length} ventas`;
    }
}

function renderTablaFiltrada() {
    const tbody = document.getElementById('histVentasBody');
    
    if (!ventasFiltradas.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#9ca3af; padding:20px;">
            No hay ventas que coincidan con los filtros
        </td></tr>`;
        return;
    }

    tbody.innerHTML = ventasFiltradas.map(v => {
        const precioUnitario = v.precio; // Precio base SIN descuento
        const precioConDescuento = v.precio * (1 - (v.descuento || 0)/100);
        const total = precioConDescuento * v.cantidad;
        
        const precioDisplay = formatMoney(precioUnitario);
        const facturaDisplay = v.factura || '-';
        const facturaColor = v.factura === 'A' ? '#3498db' : v.factura === 'B' ? '#e67e22' : '#999';

        
        return `
            <tr>
                <td>${v.fecha}</td>
                <td>${v.codigoArticulo}</td>
                <td>${v.categoria || ''}</td>
                <td class="num">${v.cantidad}</td>
                <td class="num">${precioDisplay}</td>
                <td class="num">${v.descuento ? v.descuento + '%' : '-'}</td>
                <td class="num">${formatMoney(total)}</td>
                <td>${v.tipoPago || '-'}</td>
                <td style="color: ${facturaColor}; font-weight: bold;">${facturaDisplay}</td>
            </tr>
        `;
    }).join('');
}


function limpiarFiltrosTabla() {
    // Limpiar los NUEVOS IDs
    document.getElementById('histFiltroArticulo').value = '';
    document.getElementById('histFiltroCategoria').value = '';
    document.getElementById('histFiltroTipoPago').value = '';
    document.getElementById('histFiltroMontoMin').value = '';
    document.getElementById('histFiltroMontoMax').value = '';
    document.getElementById('histFiltroCantidadMin').value = '';
    
    ventasFiltradas = [];
    
    // Redibujar la tabla original
    const anio = document.getElementById('historicoAnio').value;
    const meses = getMesesSeleccionados();
    renderHistorico(anio, meses);
    
    const label = document.getElementById('filtrosResultado');
    if (label) label.textContent = '';
}

// ==================== GRÁFICOS INTERACTIVOS ====================
let graficoActual = 'categorias';

function toggleSeccionGraficos() {
    const seccion = document.getElementById('seccionGraficos');
    const btn = document.querySelector('.btn-toggle-graficos');
    
    if (seccion.style.display === 'none') {
        seccion.style.display = 'block';
        btn.innerHTML = '<span id="iconoGraficos">▲</span> Ocultar gráficos';
        generarGraficos();
    } else {
        seccion.style.display = 'none';
        btn.innerHTML = '<span id="iconoGraficos">▼</span> Mostrar gráficos';
    }
}

function cambiarGrafico(tipo) {
    graficoActual = tipo;
    
    document.querySelectorAll('.grafico-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-chart="${tipo}"]`).classList.add('active');
    
    document.querySelectorAll('.chart-canvas').forEach(canvas => {
        canvas.classList.remove('active');
    });
    
    const chartIds = {
        'categorias': 'chartCategorias',
        'comparativa-periodo': 'chartComparativaPeriodo', // ID NUEVO
        'pagos': 'chartPagos',
        'productos': 'chartProductos'
    };
    
    const id = chartIds[tipo];
    if(id) document.getElementById(id).classList.add('active');

    // Trigger de carga si es el nuevo tab
    if (tipo === 'comparativa-periodo') {
        generarGraficoComparativoPeriodo();
    }
}

function generarGraficos() {
    generarGraficoCategorias();
    if(document.querySelector('[data-chart="comparativa-periodo"]').classList.contains('active')){
         generarGraficoComparativoPeriodo();
    }
    generarGraficoPagos();
    generarGraficoProductos();
}

function generarGraficoCategorias() {
    const datos = historicoVentas; // Sin filtros
    const categorias = {};
    
    datos.forEach(v => {
        const cat = v.categoria || 'Sin categoría';
        const precioFinal = v.precio * (1 - (v.descuento || 0)/100);
        const total = precioFinal * v.cantidad;
        
        if (!categorias[cat]) {
            categorias[cat] = { total: 0, cantidad: 0 };
        }
        categorias[cat].total += total;
        categorias[cat].cantidad += v.cantidad;
    });
    
    // Ordenar según criterio
    const criterioOrden = window.categoriasOrden || 'total';
    const entries = Object.entries(categorias).map(([cat, data]) => ({ cat, ...data }));
    
    if (criterioOrden === 'cantidad') {
        entries.sort((a, b) => b.cantidad - a.cantidad);
    } else {
        entries.sort((a, b) => b.total - a.total);
    }
    
    const totalGeneral = entries.reduce((sum, item) => sum + (criterioOrden === 'cantidad' ? item.cantidad : item.total), 0);
    
    const html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h4 style="margin: 0; color: #111827;">Ventas por categoría</h4>
            <div style="display: flex; gap: 8px; background: #f3f4f6; padding: 4px; border-radius: 8px;">
                <button 
                    onclick="cambiarOrdenCategorias('cantidad')" 
                    style="padding: 6px 14px; border: none; border-radius: 6px; font-size: 0.85em; font-weight: 600; cursor: pointer; transition: all 0.2s ease; ${criterioOrden === 'cantidad' ? 'background: #3b82f6; color: white;' : 'background: transparent; color: #6b7280;'}"
                >
                    📦 Por unidades
                </button>
                <button 
                    onclick="cambiarOrdenCategorias('total')" 
                    style="padding: 6px 14px; border: none; border-radius: 6px; font-size: 0.85em; font-weight: 600; cursor: pointer; transition: all 0.2s ease; ${criterioOrden === 'total' ? 'background: #3b82f6; color: white;' : 'background: transparent; color: #6b7280;'}"
                >
                    💰 Por monto
                </button>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px;">
            ${entries.map((item, i) => {
                const valor = criterioOrden === 'cantidad' ? item.cantidad : item.total;
                const porcentaje = (valor / totalGeneral * 100).toFixed(1);
                const colores = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#30cfd0', '#a8edea', '#ff9a9e', '#fbc2eb'];
                const color = colores[i % colores.length];
                return `
                    <div style="padding: 16px 18px; background: linear-gradient(135deg, ${color}15, ${color}25); border-left: 4px solid ${color}; border-radius: 12px; transition: all 0.2s ease;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        <div style="font-size: 0.8em; color: #6b7280; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">${item.cat}</div>
                        <div style="font-size: 1.5em; font-weight: 700; color: #111827; margin-bottom: 4px;">
                            ${criterioOrden === 'cantidad' ? item.cantidad + ' unidades' : formatMoney(item.total)}
                        </div>
                        <div style="font-size: 0.8em; color: #6b7280;">${porcentaje}% del total</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.getElementById('chartCategorias').innerHTML = html;
}

function cambiarOrdenCategorias(criterio) {
    window.categoriasOrden = criterio;
    generarGraficoCategorias();
}


function generarGraficoTiempo() {
    const datos = ventasFiltradas.length ? ventasFiltradas : historicoVentas;
    
    const ventasPorDia = {};
    datos.forEach(v => {
        const fecha = v.fecha;
        const precioFinal = v.precio * (1 - (v.descuento || 0)/100);
        const total = precioFinal * v.cantidad;
        
        if (!ventasPorDia[fecha]) {
            ventasPorDia[fecha] = { total: 0, cantidad: 0, tickets: 0 };
        }
        ventasPorDia[fecha].total += total;
        ventasPorDia[fecha].cantidad += v.cantidad;
        ventasPorDia[fecha].tickets += 1;
    });
    
    const entries = Object.entries(ventasPorDia).sort((a, b) => {
        const [diaA, mesA, anioA] = a[0].split('-');
        const [diaB, mesB, anioB] = b[0].split('-');
        return new Date(anioA, mesA - 1, diaA) - new Date(anioB, mesB - 1, diaB);
    });
    
    const maxTotal = Math.max(...entries.map(([, data]) => data.total));
    
    const html = `
        <h4 style="margin: 0 0 20px; color: #111827;">Evolución de ventas día a día</h4>
        <div style="display: grid; gap: 8px;">
            ${entries.map(([fecha, data]) => {
                const porcentaje = (data.total / maxTotal * 100);
                return `
                    <div style="display: grid; grid-template-columns: 100px 1fr 150px; gap: 12px; align-items: center; padding: 10px; background: #f9fafb; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='#f9fafb'">
                        <div style="font-size: 0.85em; font-weight: 600; color: #6b7280;">${fecha}</div>
                        <div style="background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden; position: relative;">
                            <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${porcentaje}%; transition: width 0.3s ease; display: flex; align-items: center; padding-left: 10px;">
                                <span style="font-size: 0.75em; color: white; font-weight: 600;">${data.tickets} tickets</span>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 700; color: #111827; font-size: 1em;">${formatMoney(data.total)}</div>
                            <div style="font-size: 0.75em; color: #6b7280;">${data.cantidad} prendas</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <div style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 8px;">
            <div style="font-size: 0.85em; color: #1e40af; font-weight: 600;">📊 Estadísticas del período</div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 10px;">
                <div>
                    <div style="font-size: 0.75em; color: #6b7280;">Día promedio</div>
                    <div style="font-size: 1.1em; font-weight: 700; color: #111827;">${formatMoney(entries.reduce((sum, [, data]) => sum + data.total, 0) / entries.length)}</div>
                </div>
                <div>
                    <div style="font-size: 0.75em; color: #6b7280;">Mejor día</div>
                    <div style="font-size: 1.1em; font-weight: 700; color: #111827;">${formatMoney(maxTotal)}</div>
                </div>
                <div>
                    <div style="font-size: 0.75em; color: #6b7280;">Total días</div>
                    <div style="font-size: 1.1em; font-weight: 700; color: #111827;">${entries.length}</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('chartTiempo').innerHTML = html;
}

function generarGraficoPagos() {
    const datos = ventasFiltradas.length ? ventasFiltradas : historicoVentas;
    const pagos = {};
    
    datos.forEach(v => {
        const tipo = v.tipoPago || 'No especificado';
        const precioFinal = v.precio * (1 - (v.descuento || 0)/100);
        const total = precioFinal * v.cantidad;
        pagos[tipo] = (pagos[tipo] || 0) + total;
    });
    
    const entries = Object.entries(pagos).sort((a,b) => b[1] - a[1]);
    const totalGeneral = entries.reduce((sum, [,t]) => sum + t, 0);
    
    const html = `
        <h4 style="margin: 0 0 20px; color: #111827;">Distribución de métodos de pago</h4>
        <div style="max-width: 600px;">
            ${entries.map(([tipo, total]) => {
                const porcentaje = (total / totalGeneral * 100).toFixed(1);
                return `
                    <div style="margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-weight: 600; color: #374151;">${tipo}</span>
                            <span style="font-weight: 700; color: #111827;">${formatMoney(total)}</span>
                        </div>
                        <div style="background: #e5e7eb; height: 12px; border-radius: 6px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${porcentaje}%; transition: width 0.3s ease;"></div>
                        </div>
                        <div style="font-size: 0.75em; color: #6b7280; margin-top: 4px;">${porcentaje}%</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.getElementById('chartPagos').innerHTML = html;
}

async function generarGraficoProductos() {
    // SIEMPRE usar historicoVentas (sin filtros)
    const datos = historicoVentas;
    const productos = {};
    
    datos.forEach(v => {
        const prod = v.codigoArticulo || 'Sin código';
        const precioFinal = v.precio * (1 - (v.descuento || 0)/100);
        const total = precioFinal * v.cantidad;
        
        if (!productos[prod]) {
            productos[prod] = { total: 0, cantidad: 0 };
        }
        productos[prod].total += total;
        productos[prod].cantidad += v.cantidad;
    });
    
    const productosArray = [];
    for (const codigo in productos) {
        productosArray.push({
            codigo: codigo,
            total: productos[codigo].total,
            cantidad: productos[codigo].cantidad
        });
    }
    
    // Ordenar según criterio
    const criterioOrden = window.topProductosOrden || 'cantidad';
    if (criterioOrden === 'cantidad') {
        productosArray.sort((a, b) => b.cantidad - a.cantidad);
    } else {
        productosArray.sort((a, b) => b.total - a.total);
    }
    
    const top10 = productosArray.slice(0, 10);
    
    const codigos = top10.map(item => item.codigo);
    let descripciones = {};
    
    try {
        const response = await fetch(`/api/productos/descripciones?codigos=${codigos.join(',')}`);
        if (response.ok) {
            descripciones = await response.json();
        }
    } catch (err) {
        console.error('Error obteniendo descripciones:', err);
    }
    
    const html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h4 style="margin: 0; color: #111827;">Top 10 productos más vendidos</h4>
            <div style="display: flex; gap: 8px; background: #f3f4f6; padding: 4px; border-radius: 8px;">
                <button 
                    onclick="cambiarOrdenProductos('cantidad')" 
                    style="padding: 6px 14px; border: none; border-radius: 6px; font-size: 0.85em; font-weight: 600; cursor: pointer; transition: all 0.2s ease; ${criterioOrden === 'cantidad' ? 'background: #3b82f6; color: white;' : 'background: transparent; color: #6b7280;'}"
                >
                    📦 Por unidades
                </button>
                <button 
                    onclick="cambiarOrdenProductos('total')" 
                    style="padding: 6px 14px; border: none; border-radius: 6px; font-size: 0.85em; font-weight: 600; cursor: pointer; transition: all 0.2s ease; ${criterioOrden === 'total' ? 'background: #3b82f6; color: white;' : 'background: transparent; color: #6b7280;'}"
                >
                    💰 Por monto
                </button>
            </div>
        </div>
        <div style="display: grid; gap: 10px;">
            ${top10.map((item, i) => `
                <div style="display: flex; align-items: center; padding: 12px; background: #f9fafb; border-radius: 8px; gap: 15px; transition: all 0.2s ease;" onmouseover="this.style.background='#eff6ff'; this.style.transform='translateX(5px)'" onmouseout="this.style.background='#f9fafb'; this.style.transform='translateX(0)'">
                    <div style="flex-shrink: 0; width: 35px; height: 35px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.9em;">
                        ${i + 1}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #111827; margin-bottom: 2px;">${item.codigo}</div>
                        <div style="font-size: 0.85em; color: #6b7280;">${descripciones[item.codigo] || 'Sin descripción'}</div>
                        <div style="font-size: 0.75em; color: #9ca3af; margin-top: 2px;">${item.cantidad} unidades vendidas</div>
                    </div>
                    <div style="font-weight: 700; color: #111827; font-size: 1.1em;">
                        ${formatMoney(item.total)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('chartProductos').innerHTML = html;
}

function cambiarOrdenProductos(criterio) {
    window.topProductosOrden = criterio;
    generarGraficoProductos();
}



// ==================== IMPORTAR VENTAS DESDE CSV ====================
async function uploadVentasCSV() {
    const file = document.getElementById('csvVentas').files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/ventas/import-csv', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            showAlert('alertaVentasCSV', result.error || 'Error al importar', 'danger');
            return;
        }

        let mensaje = `✅ ${result.importadas} ventas importadas correctamente`;
        if (result.omitidas > 0) {
            mensaje += ` (${result.omitidas} filas omitidas)`;
        }

        showAlert('alertaVentasCSV', mensaje, 'success');
        
        document.getElementById('csvVentas').value = '';

        setTimeout(() => {
            cargarHistorico();
        }, 1500);
    } catch (error) {
        showAlert('alertaVentasCSV', 'Error: ' + error.message, 'danger');
    }
}

async function limpiarVentasDiciembre() {
  if (!confirm('¿Seguro que querés borrar TODAS las ventas de diciembre 2025?')) {
    return;
  }

  try {
    const response = await fetch('/api/ventas-limpiar-mes', {
      method: 'DELETE'
    });

    const result = await response.json();

    if (response.ok) {
      document.getElementById('resultadoLimpiar').textContent = `✅ ${result.eliminadas} ventas eliminadas`;
      setTimeout(() => {
        cargarHistorico();
      }, 1000);
    } else {
      document.getElementById('resultadoLimpiar').textContent = `❌ Error: ${result.error}`;
    }
  } catch (error) {
    document.getElementById('resultadoLimpiar').textContent = `❌ Error: ${error.message}`;
  }
}

// ==================== GESTIÓN DE DATOS ====================

async function cargarEstadisticasDatos() {
    try {
        const [productosResp, cuentasResp, cambiosResp] = await Promise.all([
            fetch('/api/productos'),
            fetch('/api/cuentas'),
            fetch('/api/cambios')
        ]);
        
        const productos = await productosResp.json();
        const cuentas = await cuentasResp.json();
        const cambios = await cambiosResp.json();
        
        // CAJA DE VENTAS ELIMINADA COMO PEDISTE
        document.getElementById('datosStats').innerHTML = `
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; font-weight: bold; color: #1976d2;">${productos.length || 0}</div>
                <div style="color: #666; font-size: 0.9em;">Productos</div>
            </div>
            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; font-weight: bold; color: #f57c00;">${cuentas.length || 0}</div>
                <div style="color: #666; font-size: 0.9em;">Cuentas Corrientes</div>
            </div>
            <div style="background: #fce4ec; padding: 15px; border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; font-weight: bold; color: #c2185b;">${cambios.length || 0}</div>
                <div style="color: #666; font-size: 0.9em;">Cambios</div>
            </div>
        `;
    } catch (e) {
        console.error('Error cargando estadísticas:', e);
    }
}

async function limpiarVentasMes() {
    const mes = document.getElementById('limpiarMes').value;
    const anio = document.getElementById('limpiarAnio').value;
    const nombreMes = document.getElementById('limpiarMes').options[document.getElementById('limpiarMes').selectedIndex].text;
    
    if (!confirm(`¿Seguro que querés borrar TODAS las ventas de ${nombreMes} ${anio}?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/ventas/limpiar-mes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mes: parseInt(mes), anio: parseInt(anio) })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('resultadoLimpiarMes').innerHTML = `<span style="color: green;">✅ ${result.eliminadas} ventas de ${nombreMes} ${anio} eliminadas</span>`;
            cargarEstadisticasDatos();
        } else {
            document.getElementById('resultadoLimpiarMes').innerHTML = `<span style="color: red;">❌ ${result.error}</span>`;
        }
    } catch (error) {
        document.getElementById('resultadoLimpiarMes').innerHTML = `<span style="color: red;">❌ ${error.message}</span>`;
    }
}

async function limpiarTabla(tabla) {
    const nombres = {
        ventas: 'TODAS las ventas',
        cambios: 'TODOS los cambios', 
        cuentas: 'TODAS las cuentas corrientes y sus movimientos'
    };
    
    if (!confirm(`⚠️ ¿Estás SEGURO de que querés borrar ${nombres[tabla]}?\n\nEsta acción no se puede deshacer (aunque podés restaurar desde un backup).`)) {
        return;
    }
    
    // Segunda confirmación para tablas críticas
    if (!confirm(`Esta es tu última oportunidad de cancelar.\n\n¿Borrar ${nombres[tabla]}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/limpiar/${tabla}`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(`✅ ${result.mensaje}`, 'success');
            cargarEstadisticasDatos();
        } else {
            showToast(`❌ ${result.error}`, 'error');
        }
    } catch (error) {
        showToast(`❌ ${error.message}`, 'error');
    }
}

// Cargar estadísticas cuando se abre el tab de datos
const originalSwitchAdminTab = window.switchAdminTab;
window.switchAdminTab = function(tab, event) {
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById('admin' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
    if (event && event.target) event.target.classList.add('active');
    
    if (tab === 'datos') {
        cargarEstadisticasDatos();
    }
    if (tab === 'backups') {
        cargarBackups();
    }
};

// ==================== EXPORTAR HISTÓRICO ====================
function exportarHistorico(formato) {
    // Usar ventas filtradas si hay, sino todas las del histórico
    const ventas = (ventasFiltradas && ventasFiltradas.length > 0) ? ventasFiltradas : historicoVentas;
    
    if (!ventas || ventas.length === 0) {
        showToast('No hay ventas para exportar. Seleccioná un período primero.', 'error');
        return;
    }

    const periodo = document.getElementById('histPeriodoLabel')?.textContent || 'ventas';
    const fechaExport = new Date().toISOString().split('T')[0];
    
    if (formato === 'csv') {
        exportarCSV(ventas, `ventas_${fechaExport}.csv`);
    } else {
        exportarExcel(ventas, `ventas_${fechaExport}.xlsx`);
    }
}

function exportarCSV(ventas, nombreArchivo) {
    // Headers
    const headers = ['Fecha', 'Código', 'Descripción', 'Cantidad', 'Precio Unit.', 'Descuento %', 'Total', 'Categoría', 'Tipo Pago', 'Factura'];
    
    // Filas
    const filas = ventas.map(v => {
        const precioUnit = Number(v.precio) || 0;
        const cant = Number(v.cantidad) || 1;
        const desc = Number(v.descuento) || 0;
        const total = precioUnit * cant * (1 - desc/100);
        
        return [
            v.fecha,
            v.codigoArticulo,
            `"${(v.descripcion || '').replace(/"/g, '""')}"`,
            cant,
            precioUnit.toFixed(2),
            desc,
            total.toFixed(2),
            `"${(v.categoria || '').replace(/"/g, '""')}"`,
            v.tipoPago || '',
            v.factura || ''
        ].join(',');
    });
    
    const contenido = [headers.join(','), ...filas].join('\n');
    
    // BOM para Excel reconozca UTF-8
    const bom = '\uFEFF';
    const blob = new Blob([bom + contenido], { type: 'text/csv;charset=utf-8;' });
    
    descargarArchivo(blob, nombreArchivo);
    showToast(`✅ ${ventas.length} ventas exportadas a CSV`, 'success');
}

function exportarExcel(ventas, nombreArchivo) {
    // Crear HTML table que Excel puede abrir
    let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8">
        <style>
            td, th { border: 1px solid #ddd; padding: 8px; }
            th { background: #208090; color: white; }
            .numero { mso-number-format:"\\#\\,\\#\\#0\\.00"; }
        </style>
        </head>
        <body>
        <table>
            <tr>
                <th>Fecha</th>
                <th>Código</th>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Precio Unit.</th>
                <th>Descuento %</th>
                <th>Total</th>
                <th>Categoría</th>
                <th>Tipo Pago</th>
                <th>Factura</th>
            </tr>
    `;
    
    let totalGeneral = 0;
    let totalPrendas = 0;
    
    ventas.forEach(v => {
        const precioUnit = Number(v.precio) || 0;
        const cant = Number(v.cantidad) || 1;
        const desc = Number(v.descuento) || 0;
        const total = precioUnit * cant * (1 - desc/100);
        totalGeneral += total;
        totalPrendas += cant;
        
        html += `
            <tr>
                <td>${v.fecha}</td>
                <td>${v.codigoArticulo}</td>
                <td>${v.descripcion || ''}</td>
                <td class="numero">${cant}</td>
                <td class="numero">${precioUnit.toFixed(2)}</td>
                <td class="numero">${desc}</td>
                <td class="numero">${total.toFixed(2)}</td>
                <td>${v.categoria || ''}</td>
                <td>${v.tipoPago || ''}</td>
                <td>${v.factura || ''}</td>
            </tr>
        `;
    });
    
    // Fila de totales
    html += `
            <tr style="font-weight: bold; background: #f0f0f0;">
                <td colspan="3">TOTALES</td>
                <td class="numero">${totalPrendas}</td>
                <td></td>
                <td></td>
                <td class="numero">${totalGeneral.toFixed(2)}</td>
                <td colspan="3"></td>
            </tr>
        </table>
        </body></html>
    `;
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    descargarArchivo(blob, nombreArchivo);
    showToast(`✅ ${ventas.length} ventas exportadas a Excel`, 'success');
}

function descargarArchivo(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== LÓGICA COMPARATIVA ANUAL ====================

// 1. Inicializar Selectores de Años
function initComparativa() {
    const anioActual = new Date().getFullYear();
    const select1 = document.getElementById('compAnio1');
    const select2 = document.getElementById('compAnio2');
    
    // Limpiar opciones previas si las hubiera
    select1.innerHTML = '';
    select2.innerHTML = '';

    // Rellenar desde 2023 hasta año actual + 1
    for(let y = anioActual + 1; y >= 2023; y--) {
        const opt1 = new Option(y, y);
        const opt2 = new Option(y, y);
        select1.add(opt1);
        select2.add(opt2);
    }

    // Por defecto: Año pasado vs Año actual
    select1.value = anioActual - 1; 
    select2.value = anioActual;
}

// Llamar al cargar la página (agregalo dentro del window.onload existente)
// OJO: Asegurate de agregar initComparativa() en tu listener 'load' principal.

// 2. Cargar Datos del Backend
async function cargarDataComparativa() {
    const anio1 = document.getElementById('compAnio1').value;
    const anio2 = document.getElementById('compAnio2').value;

    if(anio1 === anio2) {
        showToast('⚠️ Seleccioná años distintos para comparar', 'error');
        return;
    }

    // Mostrar estado de carga
    document.getElementById('resumenComparativa').style.opacity = '0.5';
    
    try {
        const resp = await fetch(`/api/ventas/comparativa?anio1=${anio1}&anio2=${anio2}`);
        const data = await resp.json();

        if(data.ok) {
            renderResumenComparativo(data, anio1, anio2);
            renderTablaComparativa(data.comparativa, anio1, anio2);
            
            // Mostrar secciones
            document.getElementById('resumenComparativa').style.display = 'grid';
            document.getElementById('tablaComparativaContainer').style.display = 'block';
            document.getElementById('resumenComparativa').style.opacity = '1';
        } else {
            showToast('❌ Error al cargar datos: ' + data.error, 'error');
        }

    } catch(err) {
        console.error(err);
        showToast('❌ Error de conexión', 'error');
        document.getElementById('resumenComparativa').style.opacity = '1';
    }
}

// 3. Renderizar Tarjetas Superiores (KPIs)
function renderResumenComparativo(data, a1, a2) {
    const t1 = data.totales[a1];
    const t2 = data.totales[a2];

    // Actualizar etiquetas de años
    document.getElementById('lblAnio1_fact').textContent = a1;
    document.getElementById('lblAnio2_fact').textContent = a2;
    document.getElementById('lblAnio1_unid').textContent = a1;
    document.getElementById('lblAnio2_unid').textContent = a2;
    document.getElementById('lblAnio1_ticket').textContent = a1;
    document.getElementById('lblAnio2_ticket').textContent = a2;

    // Facturación
    document.getElementById('valAnio1_fact').textContent = formatMoney(t1.facturacion);
    document.getElementById('valAnio2_fact').textContent = formatMoney(t2.facturacion);
    renderVariacion('var_fact', t1.facturacion, t2.facturacion, true);

    // Unidades
    document.getElementById('valAnio1_unid').textContent = t1.unidades;
    document.getElementById('valAnio2_unid').textContent = t2.unidades;
    renderVariacion('var_unid', t1.unidades, t2.unidades, false);

    // Ticket Promedio (evitar división por cero)
    const ticket1 = t1.tickets > 0 ? t1.facturacion / t1.tickets : 0;
    const ticket2 = t2.tickets > 0 ? t2.facturacion / t2.tickets : 0;
    
    document.getElementById('valAnio1_ticket').textContent = formatMoney(ticket1);
    document.getElementById('valAnio2_ticket').textContent = formatMoney(ticket2);
    renderVariacion('var_ticket', ticket1, ticket2, true);
}

// Helper para calcular y pintar % de variación
function renderVariacion(elementId, v1, v2, esDinero) {
    const el = document.getElementById(elementId);
    let diff = 0;
    
    if (v1 > 0) {
        diff = ((v2 - v1) / v1) * 100;
    } else if (v2 > 0) {
        diff = 100; // Si antes era 0 y ahora hay ventas, creciste 100%
    }

    const diffStr = (diff > 0 ? '+' : '') + diff.toFixed(1) + '%';
    
    // Asignar clase de color
    el.className = 'badge-var ' + (diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral');
    el.textContent = diffStr;
}

// 4. Renderizar Tabla Mes a Mes
function renderTablaComparativa(filas, a1, a2) {
    // Actualizar headers de la tabla
    document.getElementById('thAnio1').textContent = `(${a1})`;
    document.getElementById('thAnio2').textContent = `(${a2})`;
    document.getElementById('thAnio1_u').textContent = `(${a1})`;
    document.getElementById('thAnio2_u').textContent = `(${a2})`;

    const tbody = document.getElementById('bodyComparativa');
    tbody.innerHTML = filas.map(fila => {
        const varDinero = fila.variacion.facturacion;
        const varUnid = fila.variacion.unidades;
        
        // Colores para las variaciones en tabla
        const colorDinero = varDinero > 0 ? 'green' : varDinero < 0 ? 'red' : '#999';
        const colorUnid = varUnid > 0 ? 'green' : varUnid < 0 ? 'red' : '#999';

        return `
            <tr>
                <td style="font-weight:600;">${fila.nombreMes}</td>
                
                <td class="text-right border-left text-muted">${formatMoney(fila.anio1.facturacion)}</td>
                <td class="text-right" style="font-weight:600;">${formatMoney(fila.anio2.facturacion)}</td>
                <td class="text-center" style="color: ${colorDinero}; font-size: 0.9em; font-weight: bold;">
                    ${varDinero > 0 ? '▲' : varDinero < 0 ? '▼' : ''} ${Math.abs(varDinero)}%
                </td>

                <td class="text-right border-left text-muted">${fila.anio1.unidades}</td>
                <td class="text-right" style="font-weight:600;">${fila.anio2.unidades}</td>
                <td class="text-center" style="color: ${colorUnid}; font-size: 0.9em; font-weight: bold;">
                    ${varUnid > 0 ? '▲' : varUnid < 0 ? '▼' : ''} ${Math.abs(varUnid)}%
                </td>
            </tr>
        `;
    }).join('');
}

async function resetearStockCero() {
    if (!confirm('⚠️ ¿Estás SEGURO de que querés poner el stock de TODOS los productos en 0?\n\nLos precios y descripciones se mantienen, solo se reinicia la cantidad.')) {
        return;
    }

    try {
        const response = await fetch('/api/admin/stock/zero', {
            method: 'POST'
        });

        const result = await response.json();

        if (response.ok) {
            showToast('✅ ' + result.mensaje, 'success');
            // Recargamos estadísticas si hace falta
            cargarEstadisticasDatos();
        } else {
            showToast('❌ Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('❌ Error de conexión', 'error');
    }
}

// ==================== LÓGICA DE PROMEDIOS MENSUALES ====================

function initPromedios() {
    const anioSelect = document.getElementById('promedioAnio');
    const mesSelect = document.getElementById('promedioMes');
    const hoy = new Date();
    
    // Llenar años (desde 2023)
    anioSelect.innerHTML = '';
    for(let y = hoy.getFullYear(); y >= 2023; y--) {
        anioSelect.add(new Option(y, y));
    }
    
    // Seleccionar mes actual por defecto
    mesSelect.value = hoy.getMonth() + 1;
}

// Llamar a initPromedios al cargar la página (agregalo en el window load)

async function cargarPromedios() {
    const anio = parseInt(document.getElementById('promedioAnio').value);
    const mes = parseInt(document.getElementById('promedioMes').value);
    const tbody = document.getElementById('tablaPromediosBody');
    
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Cargando...</td></tr>';

    try {
        const resp = await fetch(`/api/ventas/promedios?anio=${anio}&mes=${mes}`);
        const data = await resp.json();
        
        if (!data.ok) throw new Error(data.error);
        
        renderTablaPromedios(data.ventas, anio, mes);
        
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" style="color: red; text-align:center;">Error al cargar datos</td></tr>';
    }
}

// Lista de feriados fijos (Formato DD-MM). Podés agregar los móviles acá.
const FERIADOS_ARG = [
    '01-01', // Año Nuevo
    '24-03', // Memoria
    '02-04', // Malvinas
    '01-05', // Trabajador
    '25-05', // Revolución Mayo
    '20-06', // Bandera
    '09-07', // Independencia
    '17-08', // San Martín
    '12-10', // Diversidad
    '20-11', // Soberanía
    '08-12', // Inmaculada
    '25-12'  // Navidad
];

function esFeriado(dia, mes) {
    const key = `${dia.toString().padStart(2, '0')}-${mes.toString().padStart(2, '0')}`;
    return FERIADOS_ARG.includes(key);
}

function renderTablaPromedios(ventasMap, anio, mes) {
    const tbody = document.getElementById('tablaPromediosBody');
    tbody.innerHTML = '';

    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    
    const esMesActual = hoy.getFullYear() === anio && (hoy.getMonth() + 1) === mes;
    const diasEnMes = new Date(anio, mes, 0).getDate();
    
    let acumuladoDinero = 0;
    let acumuladoPrendas = 0; // Nuevo acumulador
    
    let diasOperativos = 0; 
    let diasOperativosTotalesMes = 0; 
    
    let html = '';

    // 1. CALCULAR DÍAS OPERATIVOS TOTALES (Pre-cálculo)
    for (let d = 1; d <= diasEnMes; d++) {
        const f = new Date(anio, mes - 1, d);
        const esDom = f.getDay() === 0;
        const esFer = esFeriado(d, mes);
        
        const key = `${anio}-${mes.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        // Ahora accedemos a .dinero porque ventasMap es un objeto
        const datosDia = ventasMap[key] || { dinero: 0, prendas: 0 };
        const tuvoVenta = datosDia.dinero > 0;

        if ((!esDom && !esFer) || tuvoVenta) {
            diasOperativosTotalesMes++;
        }
    }

    // 2. RENDERIZAR TABLA Y SUMAR
    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fechaObj = new Date(anio, mes - 1, dia);
        const esDomingo = fechaObj.getDay() === 0;
        const esDiaFeriado = esFeriado(dia, mes);
        
        const fechaStr = `${anio}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
        
        // RECUPERAR DATOS DEL DÍA (NUEVO FORMATO)
        const datosDia = ventasMap[fechaStr] || { dinero: 0, prendas: 0 };
        const ventaDia = datosDia.dinero;
        const prendasDia = datosDia.prendas;
        
        const esHoy = fechaObj.getTime() === hoy.getTime();
        const esFuturo = fechaObj.getTime() > hoy.getTime();

        const esDiaHabil = !esDomingo && !esDiaFeriado;
        const cuentaParaPromedio = esDiaHabil || (ventaDia > 0);

        acumuladoDinero += ventaDia;
        acumuladoPrendas += prendasDia; // Sumamos prendas

        if (!esFuturo && cuentaParaPromedio) {
            diasOperativos++;
        }

        let promedioDinero = 0;
        if (diasOperativos > 0) {
            promedioDinero = acumuladoDinero / diasOperativos;
        }

        // Estilos
        let claseFila = '';
        let estiloDia = '';
        let labelExtra = '';

        if (esHoy) {
            claseFila = 'fila-hoy';
            labelExtra += '<span class="tag-hoy">HOY</span>';
        } else if (esFuturo) {
            claseFila = 'fila-futura';
        } else if (!cuentaParaPromedio) {
            claseFila = 'fila-no-laborable';
            estiloDia = 'color: #aaa; font-style: italic;';
        }

        if (esDomingo) labelExtra += ' <small style="color:#e74c3c">(Dom)</small>';
        if (esDiaFeriado) labelExtra += ' <small style="color:#e67e22">(Fer)</small>';

        const nombreDia = fechaObj.toLocaleDateString('es-AR', { weekday: 'short' });

        html += `
            <tr class="${claseFila}" style="${estiloDia}">
                <td>
                    ${dia} <span style="font-size:0.8em; color:#999; text-transform: uppercase; margin-left: 5px;">${nombreDia}</span>
                    ${labelExtra}
                </td>
                <td style="${ventaDia > 0 ? 'color: #2c3e50; font-weight:600;' : 'color: #ccc;'}">
                    ${formatMoney(ventaDia)}
                    ${prendasDia > 0 ? `<span style="font-size:0.75em; color:#e67e22; margin-left:5px;">(${prendasDia} un.)</span>` : ''}
                </td>
                <td class="col-acumulado">${!esFuturo || esHoy ? formatMoney(acumuladoDinero) : '-'}</td>
                <td class="col-promedio">
                    ${(!esFuturo || esHoy) && cuentaParaPromedio ? formatMoney(promedioDinero) : '-'}
                </td>
            </tr>
        `;
    }

    tbody.innerHTML = html;

    // --- ACTUALIZAR TARJETAS ---
    
    // 1. Dinero
    document.getElementById('promTotalMes').textContent = formatMoney(acumuladoDinero);
    document.getElementById('promDiasTranscurridos').textContent = diasOperativos;
    const promDineroFinal = diasOperativos > 0 ? acumuladoDinero / diasOperativos : 0;
    document.getElementById('promPromedioActual').textContent = formatMoney(promDineroFinal);

    // 2. Prendas (NUEVO)
    document.getElementById('promTotalPrendas').textContent = acumuladoPrendas + ' un.';
    const promPrendasFinal = diasOperativos > 0 ? (acumuladoPrendas / diasOperativos).toFixed(1) : '0.0';
    document.getElementById('promPromedioPrendas').textContent = promPrendasFinal;

    // 3. Proyección
    if (esMesActual && diasOperativos > 0) {
        const proyeccion = promDineroFinal * diasOperativosTotalesMes;
        document.getElementById('promProyeccion').textContent = formatMoney(proyeccion);
        document.getElementById('promProyeccion').style.color = '#27ae60';
        document.getElementById('promProyeccion').style.fontWeight = 'bold';
    } else {
        document.getElementById('promProyeccion').textContent = '-';
        document.getElementById('promProyeccion').style.color = '#aaa';
        document.getElementById('promProyeccion').style.fontWeight = 'normal';
    }
    
    // Scroll a hoy
    if (esMesActual) {
        setTimeout(() => {
            const filaHoy = document.querySelector('.fila-hoy');
            if(filaHoy) filaHoy.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}

// ==================== LÓGICA MODAL CTA CTE ====================
function abrirModalCtaCte() {
    document.getElementById('modalCtaCte').classList.add('active');
    document.getElementById('ccNombre').focus();
    
    // Pre-llenar artículo si hay uno en la venta
    const artVenta = document.getElementById('articulo').value;
    if(artVenta) document.getElementById('ccArticulo').value = artVenta;
}

function cerrarModalCtaCte() {
    document.getElementById('modalCtaCte').classList.remove('active');
}

async function confirmarVentaCtaCte() {
    const nombre = document.getElementById('ccNombre').value.trim();
    const telefono = document.getElementById('ccTelefono').value.trim();
    const articuloCC = document.getElementById('ccArticulo').value.trim();
    const comentarioCC = document.getElementById('ccComentarios').value.trim();

    if (!nombre) {
        showToast('⚠️ El nombre es obligatorio', 'error');
        return;
    }

    try {
        // 1. Crear o Actualizar la Cuenta
        await fetch('/api/cuentas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente: nombre, telefono, articulo: articuloCC })
        });

        // 2. Preparar datos
        const precioField = document.getElementById('precio');
        const cantidadField = document.getElementById('cantidad');
        const esCambio = document.getElementById('esCambio').checked;
        const descuento = parseInt(document.getElementById('descuento').value) || 0;
        
        let cantidadOriginal = parseInt(cantidadField.value);
        let precioOriginal = parseFloat(precioField.value);
        
        // Si estaba en modo "visual" devolución, el input precio ya es 0. 
        // Intentamos recuperar el valor original del dataset.
        if (esCambio && precioOriginal === 0 && precioField.dataset.oldValue) {
            precioOriginal = parseFloat(precioField.dataset.oldValue);
        }

        // --- LÓGICA DE MOVIMIENTO EN CUENTA ---
        let tipoMovimiento = 'deuda';
        let montoMovimiento = 0;
        let comentarioMovimiento = '';

        if (esCambio) {
            // DEVOLUCIÓN: Genera saldo A FAVOR (pago) por el valor del producto
            tipoMovimiento = 'pago';
            // Calculamos el valor real del artículo devuelto
            montoMovimiento = precioOriginal * Math.abs(cantidadOriginal);
            comentarioMovimiento = `Devolución: ${document.getElementById('articulo').value}`;
        } else {
            // VENTA NORMAL: Genera DEUDA
            tipoMovimiento = 'deuda';
            montoMovimiento = precioOriginal * cantidadOriginal * (1 - descuento/100);
            comentarioMovimiento = `Compra: ${document.getElementById('articulo').value}`;
        }

        // 3. Registrar la Venta en el Histórico (Para stock y caja)
        // Aquí SÍ aplicamos la lógica de venta: si es cambio, precio 0 y cantidad negativa.
        const ventaBody = {
            fecha: document.getElementById('fecha').value,
            articulo: document.getElementById('articulo').value.trim(),
            cantidad: esCambio ? (-1 * Math.abs(cantidadOriginal)) : cantidadOriginal,
            precio: esCambio ? 0 : precioOriginal,
            descuento: esCambio ? 0 : descuento,
            categoria: document.getElementById('categoria').value.trim(),
            factura: document.querySelector('.factura-btn.active').dataset.value,
            tipoPago: 'Cta Cte',
            comentarios: `${document.getElementById('comentarios').value} | ${comentarioCC}`
        };

        const respVenta = await fetch('/api/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ventaBody)
        });

        if (!respVenta.ok) throw new Error('Error registrando venta');

        // 4. Registrar el Movimiento en la Cuenta
        if (montoMovimiento > 0) {
            await fetch(`/api/cuentas/${encodeURIComponent(nombre)}/movimiento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: tipoMovimiento,
                    monto: montoMovimiento,
                    fecha: document.getElementById('fecha').value,
                    comentario: comentarioMovimiento
                })
            });
        }

        showToast('✅ Operación registrada en Cta. Cte.', 'success');
        cerrarModalCtaCte();
        
        // Limpieza
        document.getElementById('articulo').value = '';
        document.getElementById('precio').value = '';
        document.getElementById('precio').readOnly = false; // Resetear si estaba bloqueado
        document.getElementById('precio').style.backgroundColor = '';
        document.getElementById('cantidad').value = '1';
        document.getElementById('tipoPago').value = 'Otro';
        document.getElementById('esCambio').checked = false;
        
        // Limpiar modal
        document.getElementById('ccNombre').value = '';
        document.getElementById('ccTelefono').value = '';
        document.getElementById('ccArticulo').value = '';
        document.getElementById('ccComentarios').value = '';
        
        actualizarTotalACobrar();
        cargarVentasDelMes();

    } catch (e) {
        console.error(e);
        showToast('❌ Error: ' + e.message, 'error');
    }
}

// ==================== EDICIÓN RÁPIDA DE STOCK (TABLA) ====================
let stockEditando = false; // Flag para evitar conflictos

function editarStock(td, codigo) {
    if (stockEditando) return; // Si ya hay uno abierto, no hacemos nada
    
    const valorActual = parseInt(td.innerText);
    stockEditando = true;

    // Reemplazar texto por input
    td.innerHTML = `<input type="number" class="input-stock-edit" value="${valorActual}" id="inputStock_${codigo}" style="width: 80px; text-align: center; padding: 4px; border: 2px solid #27ae60; border-radius: 4px; font-weight: bold;">`;
    
    const input = document.getElementById(`inputStock_${codigo}`);
    input.focus();
    input.select(); // Selecciona todo el número para borrar fácil

    // Guardar al perder foco o dar Enter
    const guardar = async () => {
        const nuevoValor = parseInt(input.value);
        
        // Si no cambió o es inválido, volvemos a mostrar el número y listo
        if (isNaN(nuevoValor) || nuevoValor === valorActual) {
            td.innerHTML = valorActual;
            stockEditando = false;
            return;
        }

        try {
            const resp = await fetch('/api/productos/stock/unitario', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo, nuevoStock: nuevoValor })
            });

            if (resp.ok) {
                td.innerHTML = nuevoValor;
                // Efecto visual de "guardado"
                td.style.backgroundColor = '#d4edda';
                setTimeout(() => td.style.backgroundColor = '', 500);
                
                // Actualizar array local para que el buscador siga funcionando bien sin recargar
                const p = productosCache.find(p => p.codigo === codigo);
                if (p) p.stock = nuevoValor;
                
                showToast(`Stock actualizado: ${nuevoValor}`, 'success');
            } else {
                td.innerHTML = valorActual; // Restaurar si falló
                showToast('❌ Error al guardar', 'error');
            }
        } catch (e) {
            td.innerHTML = valorActual;
            showToast('❌ Error de conexión', 'error');
        } finally {
            stockEditando = false;
        }
    };

    // Eventos del input
    input.addEventListener('blur', guardar); // Si hace click afuera
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur(); // Dispara el evento blur que guarda
        }
        if (e.key === 'Escape') {
            td.innerHTML = valorActual; // Cancela
            stockEditando = false;
        }
    });
}

// ==================== FUNCIONES NUEVO PRODUCTO (FALTABAN ESTAS) ====================

function abrirModalProducto(codigoSugerido = '') {
    const modal = document.getElementById('modalNuevoProducto');
    if (!modal) return;

    modal.classList.add('active');
    
    const inputCodigo = document.getElementById('npCodigo');
    inputCodigo.value = codigoSugerido.toUpperCase();
    
    // Resetear resto
    document.getElementById('npDescripcion').value = '';
    document.getElementById('npCategoria').value = '';
    document.getElementById('npPrecio').value = 0;
    document.getElementById('npCosto').value = 0;
    document.getElementById('npStock').value = 0;
    
    // INTELIGENCIA DE FOCO:
    setTimeout(() => {
        if (codigoSugerido) {
            // Si ya hay código, vamos a la descripción
            document.getElementById('npDescripcion').focus();
        } else {
            // Si está vacío, foco en el código para escribir
            inputCodigo.focus();
        }
    }, 100);
}

function cerrarModalProducto() {
    const modal = document.getElementById('modalNuevoProducto');
    if (modal) modal.classList.remove('active');
}

async function guardarNuevoProducto() {
    const btnGuardar = event.target;
    const txtOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = 'Guardando...';

    const producto = {
        codigo: document.getElementById('npCodigo').value.trim(),
        descripcion: document.getElementById('npDescripcion').value.trim(),
        categoria: document.getElementById('npCategoria').value.trim(),
        precio: parseFloat(document.getElementById('npPrecio').value) || 0,
        costo: parseFloat(document.getElementById('npCosto').value) || 0,
        stock: parseInt(document.getElementById('npStock').value) || 0
    };

    if (!producto.descripcion) {
        showToast('⚠️ La descripción es obligatoria', 'error');
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = txtOriginal;
        return;
    }

    try {
        const resp = await fetch('/api/productos/nuevo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(producto)
        });
        
        const data = await resp.json();
        
        if (resp.ok) {
            showToast('✅ Producto creado correctamente', 'success');
            cerrarModalProducto();
            
            // Limpiar buscadores y recargar datos
            const buscadorStock = document.getElementById('stockBusquedaCodigo');
            if(buscadorStock) {
                buscadorStock.value = '';
                // Disparar evento para limpiar el mensaje de "no encontrado"
                buscadorStock.dispatchEvent(new Event('keyup'));
            }
            
            cargarStockCompleto(); 
        } else {
            showToast('❌ ' + (data.error || 'Error al crear'), 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Error de conexión', 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = txtOriginal;
    }
}

async function eliminarProducto(codigo, descripcion) {
    // Confirmación nativa (Rápida y segura)
    if (!confirm(`⚠️ ¿Estás SEGURO de eliminar este producto?\n\n${codigo} - ${descripcion}\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const resp = await fetch(`/api/productos/${encodeURIComponent(codigo)}`, {
            method: 'DELETE'
        });

        if (resp.ok) {
            showToast('🗑️ Producto eliminado', 'success');
            // Eliminamos del cache local para que desaparezca al instante sin recargar todo
            productosCache = productosCache.filter(p => p.codigo !== codigo);
            renderStockTabla(); // Redibujar tabla
            renderStockResumen(); // Actualizar contadores
        } else {
            const data = await resp.json();
            showToast('❌ ' + (data.error || 'Error al eliminar'), 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Error de conexión', 'error');
    }
}

// ==================== COMPARATIVA VS AÑO ANTERIOR (TABLA) ====================
async function generarGraficoComparativoPeriodo() {
    const contenedor = document.getElementById('chartComparativaPeriodo');
    contenedor.innerHTML = '<div style="text-align:center; padding:20px;"><span class="loading-spinner"></span> Cargando datos año anterior...</div>';

    // 1. Obtener parámetros actuales
    const anioActual = parseInt(document.getElementById('historicoAnio').value);
    const anioAnterior = anioActual - 1;
    const meses = getMesesSeleccionados(); // Tu función existente que devuelve array [1, 2, ...]

    if (meses.length === 0) {
        contenedor.innerHTML = '<div class="alert alert-warning">Seleccioná al menos un mes arriba.</div>';
        return;
    }

    try {
        // 2. Buscar datos del año anterior (Fetch manual porque historicoVentas tiene solo el año actual)
        const resp = await fetch(`/api/ventas/historico?anio=${anioAnterior}&meses=${meses.join(',')}`);
        const ventasAnterior = await resp.json();

        // 3. Procesar datos Actuales (Ya los tenemos en historicoVentas)
        const datosActual = procesarDatosParaTabla(historicoVentas);
        const datosAnterior = procesarDatosParaTabla(ventasAnterior);

        // 4. Unir Categorías (Todas las que existan en A o B)
        const todasCategorias = new Set([...Object.keys(datosActual.porCategoria), ...Object.keys(datosAnterior.porCategoria)]);
        const listaCategorias = Array.from(todasCategorias).sort();

        // 5. Renderizar
        const totalVar = calcularVariacion(datosAnterior.total, datosActual.total);
        const totalUnidVar = calcularVariacion(datosAnterior.unidades, datosActual.unidades);

        let html = `
            <div class="header-comp-periodo">
                <h3 style="margin:0; color:#1565c0;">
                    ${obtenerNombreMeses(meses)} ${anioActual} <small style="color:#555">vs</small> ${anioAnterior}
                </h3>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                <div class="comp-card" style="border-left: 5px solid #27ae60;">
                    <h4 style="margin:0 0 5px 0; font-size:0.9em; color:#666;">Facturación Total</h4>
                    <div style="display:flex; justify-content:space-between; align-items:end;">
                        <div>
                            <div style="font-size:0.8em; color:#888;">${anioAnterior}: ${formatMoney(datosAnterior.total)}</div>
                            <div class="valor" style="color:#27ae60;">${formatMoney(datosActual.total)}</div>
                        </div>
                        <div class="var-pill ${totalVar.clase}">${totalVar.texto}</div>
                    </div>
                </div>
                <div class="comp-card" style="border-left: 5px solid #e67e22;">
                    <h4 style="margin:0 0 5px 0; font-size:0.9em; color:#666;">Unidades Vendidas</h4>
                    <div style="display:flex; justify-content:space-between; align-items:end;">
                         <div>
                            <div style="font-size:0.8em; color:#888;">${anioAnterior}: ${datosAnterior.unidades} u.</div>
                            <div class="valor" style="color:#d35400;">${datosActual.unidades} u.</div>
                        </div>
                        <div class="var-pill ${totalUnidVar.clase}">${totalUnidVar.texto}</div>
                    </div>
                </div>
            </div>

            <h4 style="margin-bottom:10px;">Desglose por Categoría</h4>
            <div style="overflow-x:auto;">
                <table class="tabla-comp-periodo">
                    <thead>
                        <tr>
                            <th>Categoría</th>
                            <th>${anioAnterior} ($)</th>
                            <th>${anioActual} ($)</th>
                            <th>Diferencia $</th>
                            <th>Var %</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        listaCategorias.forEach(cat => {
            const valAnt = datosAnterior.porCategoria[cat] || 0;
            const valAct = datosActual.porCategoria[cat] || 0;
            const dif = valAct - valAnt;
            const variacion = calcularVariacion(valAnt, valAct);

            html += `
                <tr>
                    <td>${cat}</td>
                    <td style="color:#888;">${formatMoney(valAnt)}</td>
                    <td style="font-weight:bold;">${formatMoney(valAct)}</td>
                    <td style="color:${dif >= 0 ? '#27ae60' : '#e74c3c'}">${dif >= 0 ? '+' : ''}${formatMoney(dif)}</td>
                    <td><span class="var-pill ${variacion.clase}">${variacion.texto}</span></td>
                </tr>
            `;
        });

        html += `   </tbody>
                </table>
            </div>
        `;

        contenedor.innerHTML = html;

    } catch (e) {
        console.error(e);
        contenedor.innerHTML = '<div class="alert alert-danger">Error al cargar comparativa.</div>';
    }
}

// Helpers para la comparativa
function procesarDatosParaTabla(listaVentas) {
    let total = 0;
    let unidades = 0;
    const porCategoria = {};

    listaVentas.forEach(v => {
        const precioFinal = v.precio * (1 - (v.descuento || 0) / 100);
        const subtotal = precioFinal * v.cantidad;
        
        total += subtotal;
        unidades += v.cantidad;

        const cat = v.categoria || 'Sin Categoría';
        porCategoria[cat] = (porCategoria[cat] || 0) + subtotal;
    });

    return { total, unidades, porCategoria };
}

function calcularVariacion(anterior, actual) {
    if (anterior === 0) {
        return actual > 0 
            ? { texto: 'N/A (Nuevo)', clase: 'var-pos' } 
            : { texto: '-', clase: 'var-neu' };
    }
    const porc = ((actual - anterior) / anterior) * 100;
    return {
        texto: (porc > 0 ? '+' : '') + porc.toFixed(1) + '%',
        clase: porc > 0 ? 'var-pos' : porc < 0 ? 'var-neg' : 'var-neu'
    };
}

function obtenerNombreMeses(mesesArr) {
    const todos = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    if (mesesArr.length === 12) return "Año Completo";
    if (mesesArr.length === 1) return todos[mesesArr[0]-1];
    // Rango simple (ej: Ene - Mar)
    const sorted = [...mesesArr].sort((a,b)=>a-b);
    return `${todos[sorted[0]-1]} - ${todos[sorted[sorted.length-1]-1]}`;
}

// ==================== SUPER ADMIN LOGIC ====================

function abrirSuperAdmin() {
    document.getElementById('modalSuperAdmin').classList.add('active');
    cargarUsuariosSaas();
}

function cerrarSuperAdmin() {
    document.getElementById('modalSuperAdmin').classList.remove('active');
}

async function cargarUsuariosSaas() {
    const tbody = document.getElementById('listaUsuariosBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Cargando...</td></tr>';

    try {
        const resp = await fetch('/api/admin/usuarios');
        if (!resp.ok) throw new Error('Error de permisos');
        const usuarios = await resp.json();

        if (usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No hay clientes aún.</td></tr>';
            return;
        }

        tbody.innerHTML = usuarios.map(u => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding:10px; font-weight:bold; color:#2c3e50;">${u.usuario}</td>
                <td style="padding:10px;">${u.nombreComercio || '-'}</td>
                <td style="padding:10px; color:#666;">${new Date(u.fechaCreacion).toLocaleDateString()}</td>
                <td style="padding:10px; text-align:center;">
                    <span style="background:#d4edda; color:#155724; padding:2px 8px; border-radius:12px; font-size:0.8em; font-weight:bold;">Activo</span>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red; padding:20px;">Error: ${e.message}</td></tr>`;
    }
}

async function crearUsuarioSaas() {
    const usuario = document.getElementById('saUser').value.trim();
    const password = document.getElementById('saPass').value.trim();
    const nombreComercio = document.getElementById('saNombre').value.trim();

    if (!usuario || !password) {
        showToast('⚠️ Usuario y contraseña requeridos', 'error'); // Usamos tu sistema de toast existente
        return;
    }

    try {
        const resp = await fetch('/api/admin/crear-usuario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password, nombreComercio })
        });

        const data = await resp.json();

        if (resp.ok) {
            showToast('✅ Cliente creado correctamente', 'success');
            // Limpiar campos
            document.getElementById('saUser').value = '';
            document.getElementById('saPass').value = '';
            document.getElementById('saNombre').value = '';
            // Recargar lista
            cargarUsuariosSaas();
        } else {
            showToast('❌ ' + (data.error || 'Error al crear'), 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Error de conexión', 'error');
    }
}

async function eliminarCatalogoCompleto() {
    // Doble confirmación para evitar desastres
    if (!confirm('⚠️ ¡PELIGRO!\n\nEstás a punto de BORRAR TODOS LOS PRODUCTOS del sistema.\n\nEsto no se puede deshacer. ¿Estás 100% seguro?')) return;
    if (!confirm('¿De verdad? Confirmá una vez más que querés vaciar el catálogo.')) return;

    try {
        const resp = await fetch('/api/admin/productos/eliminar-todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await resp.json();

        if (resp.ok) {
            showToast('🗑️ Catálogo eliminado correctamente', 'success');
            // Opcional: Recargar la página o limpiar la tabla visualmente
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast('❌ Error: ' + data.error, 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('❌ Error de conexión', 'error');
    }
}

async function copiarMovimientoCC(detalle, monto, tipoCaja, fecha) {
    // 1. Pedir nombre del cliente
    const cliente = prompt(`Pasar movimiento a Cta. Cte.\n"${detalle}" ($${monto})\n\nIngresá el nombre del Cliente:`);
    if (!cliente || !cliente.trim()) return;

    // 2. Definir lógica: 
    // Si entró plata a la caja (Ingreso) -> Es un PAGO del cliente (A favor).
    // Si salió plata de la caja (Egreso) -> Es DEUDA (Le prestamos o gastamos en él).
    const tipoCC = tipoCaja === 'ingreso' ? 'pago' : 'deuda';
    const comentario = `Desde Caja: ${detalle}`;

    try {
        // A. Asegurar que la cuenta exista (si no, la crea)
        await fetch('/api/cuentas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente: cliente })
        });

        // B. Registrar el movimiento
        const resp = await fetch(`/api/cuentas/${encodeURIComponent(cliente)}/movimiento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo: tipoCC,
                monto: monto,
                fecha: fecha,
                comentario: comentario
            })
        });

        if (resp.ok) {
            showToast(`✅ Movimiento copiado a ${cliente} (${tipoCC})`, 'success');
        } else {
            throw new Error('Error al registrar en cuenta');
        }

    } catch (e) {
        console.error(e);
        showToast('❌ Error: ' + e.message, 'error');
    }
}

// --- FUNCIONES PARA EDITAR MOVIMIENTOS ---

async function editarMovimientoCaja(id, textoActual) {
    const nuevoTexto = prompt("Editar detalle del movimiento:", textoActual);
    if (nuevoTexto === null) return; // Cancelar

    try {
        const resp = await fetch(`/api/caja/movimiento/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ detalle: nuevoTexto.trim() })
        });

        if (resp.ok) {
            showToast('✅ Detalle actualizado', 'success');
            if (typeof fechaSeleccionada !== 'undefined') cargarVentasDelDia(fechaSeleccionada);
        } else {
            alert('Error al actualizar');
        }
    } catch (e) {
        console.error(e);
    }
}

async function editarMovimientoCuenta(id, textoActual) {
    const nuevoTexto = prompt("Editar comentario de la cuenta:", textoActual);
    if (nuevoTexto === null) return; // Cancelar

    try {
        const resp = await fetch(`/api/cuentas/movimiento/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comentario: nuevoTexto.trim() })
        });

        if (resp.ok) {
            showToast('✅ Comentario actualizado', 'success');
            cargarCuentas(); // Recargamos para ver el cambio en el historial
        } else {
            alert('Error al actualizar');
        }
    } catch (e) {
        console.error(e);
    }
}