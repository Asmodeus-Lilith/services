import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// These tests intentionally avoid @testing-library/* (not installed in this
// project) and render the real app into jsdom instead.

global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const renderApp = async () => {
  await act(async () => {
    root.render(<App />);
  });
  return container.innerHTML;
};

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  global.fetch = vi.fn().mockImplementation((url) => {
    const textData = url.includes('/catalog')
      ? JSON.stringify({ categories: [], services: [] })
      : url.includes('/notifications')
      ? JSON.stringify({ notifications: [], count: 0 })
      : url.includes('/wishlist')
      ? JSON.stringify({ services: [] })
      : url.includes('/orders')
      ? JSON.stringify({ orders: [] })
      : url.includes('/cart')
      ? JSON.stringify({ items: [] })
      : JSON.stringify({});

    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(textData)
    });
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

test('renders the ServiceHub brand and primary navigation', async () => {
  const html = await renderApp();

  expect(html).toContain('ServiceHub');
  expect(html).toContain('All Services');
});

test('renders the 404 page for an unknown route', async () => {
  window.history.pushState({}, '', '/a-route-that-does-not-exist');

  const html = await renderApp();

  expect(html).toContain('404');
  expect(html).toMatch(/this page took the day off/i);
});
