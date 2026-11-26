// The same isolate with the import made dynamic.
export default {
  async start(ctx) {
    const { label } = await import('./y.js');
    const p = ctx.root.ownerDocument.createElement('p');
    p.setAttribute('data-where', '');
    p.textContent = label + ' (dynamic)';
    ctx.root.append(p);
  },
};
