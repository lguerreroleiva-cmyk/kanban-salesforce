import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? '';
const DETAIL =
  'Desarrollo del componente para capturar solicitudes, validar los campos del formulario y comunicarse con los métodos Apex correspondientes';

test.skip(!EMAIL || !PASSWORD, 'Definir E2E_EMAIL y E2E_PASSWORD (usuario de prueba del stack local).');

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Tableros' })).toBeVisible();
}

async function newTask(page: Page, title: string) {
  await page.getByPlaceholder('+ Nueva tarea').first().fill(title);
  await page.getByPlaceholder('+ Nueva tarea').first().press('Enter');
  await page.getByRole('button', { name: title }).click();
  await expect(page.getByRole('dialog', { name: 'Detalle de la tarea' })).toBeVisible();
}

async function addPortalEmpresa(page: Page, intervention = 'Nuevo') {
  await page.getByRole('button', { name: /agregar componente/i }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Agregar componente' });
  await dialog.getByLabel('Buscar tipo de componente').fill('lightning web');
  await dialog.getByLabel('Tipo de componente *').selectOption({ label: 'Lightning Web Component · LightningComponentBundle' });
  await dialog.getByLabel('Nombre (API Name) *').fill('PortalEmpresa');
  await dialog.getByText(intervention, { exact: true }).click();
  await dialog.getByLabel('Detalle del trabajo realizado').click();
  await page.keyboard.type(DETAIL);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

test('criterios 1, 2 y 3: registrar, editar con historial y buscar entre tareas', async ({ page }, info) => {
  const suffix = `${info.project.name}-${Date.now()}`;
  await login(page);
  await page.getByLabel('Nombre del tablero').fill(`E2E ${suffix}`);
  await page.getByRole('button', { name: 'Crear' }).click();
  await page.getByRole('link', { name: `E2E ${suffix}` }).click();

  // Criterio 1
  await newTask(page, `Tarea A ${suffix}`);
  await addPortalEmpresa(page);
  const item = page.getByTestId('component-item');
  await expect(item.getByTestId('intervention-badge')).toHaveText(/Nuevo/);
  await expect(page.getByTestId('components-counter')).toHaveText('1');
  await page.reload();
  await expect(page.getByTestId('component-item')).toContainText('PortalEmpresa');

  // Criterio 2
  await page.getByRole('button', { name: 'Editar PortalEmpresa' }).click();
  const edit = page.getByRole('dialog', { name: 'Editar componente' });
  await edit.getByText('Actualizado', { exact: true }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  const history = page.locator('.history');
  await expect(history).toContainText('editó un componente');
  await expect(history.locator('del').first()).toHaveText('Nuevo');
  await expect(history.locator('ins').first()).toHaveText('Actualizado');

  // Duplicado en la misma tarea
  await page.getByRole('button', { name: /agregar componente/i }).first().click();
  const dup = page.getByRole('dialog', { name: 'Agregar componente' });
  await dup.getByLabel('Tipo de componente *').selectOption({ label: 'Lightning Web Component · LightningComponentBundle' });
  await dup.getByLabel('Nombre (API Name) *').fill('portalempresa');
  await dup.getByText('Nuevo', { exact: true }).click();
  await dup.getByLabel('Detalle del trabajo realizado').click();
  await page.keyboard.type('x');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(dup.getByText(/ya está registrado en la tarea/)).toBeVisible();
  await dup.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Descartar' }).click();

  // Criterio 3
  await page.getByRole('button', { name: 'Cerrar detalle' }).click();
  await newTask(page, `Tarea B ${suffix}`);
  await addPortalEmpresa(page, 'Configurado');
  await page.goto('/components/search?q=portalempresa');
  await expect(page.getByRole('link', { name: `Tarea A ${suffix}` })).toBeVisible();
  await expect(page.getByRole('link', { name: `Tarea B ${suffix}` })).toBeVisible();
});

test('responsivo: en móvil el formulario ocupa la pantalla y no hay scroll horizontal', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await login(page);
  await page.getByLabel('Nombre del tablero').fill(`Móvil ${Date.now()}`);
  await page.getByRole('button', { name: 'Crear' }).click();
  await page.locator('.board-card').last().click();
  await newTask(page, `Tarea móvil ${Date.now()}`);
  await page.getByRole('button', { name: /agregar componente/i }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Agregar componente' });
  const box = await dialog.boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.width).toBeGreaterThanOrEqual(vp.width - 1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
