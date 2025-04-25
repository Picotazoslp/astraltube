import React from "react";

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-900 text-white px-4 py-6 font-sans">
      <h1 className="text-4xl font-bold text-yellow-400 mb-4">🔥 Picotazos LP</h1>
      <p className="mb-6 text-lg">¡Elegí tu combo y hacé tu pedido por WhatsApp!</p>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">🍗 Combos</h2>
        <ul className="space-y-3">
          <li className="bg-zinc-800 p-4 rounded-xl shadow">
            <strong>Personal</strong>: 6 alitas (hasta 2 salsas), 1 porción de papas a elección – <span className="text-green-400">$5600</span>
          </li>
          <li className="bg-zinc-800 p-4 rounded-xl shadow">
            <strong>Para 2</strong>: 12 alitas (2 salsas), 2 porciones de papas – <span className="text-green-400">$8500</span>
          </li>
          <li className="bg-zinc-800 p-4 rounded-xl shadow">
            <strong>Familiar</strong>: 30 alitas, 5 porciones de papas – <span className="text-green-400">$20000</span>
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">🍟 Tipos de papas</h2>
        <ul className="list-disc list-inside text-gray-300">
          <li>Comunes (ajo, perejil)</li>
          <li>Con cáscara (ajo, perejil)</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">🌶️ Salsas</h2>
        <ul className="list-disc list-inside text-gray-300">
          <li>Miel Mostaza</li>
          <li>BBQ</li>
          <li>BBQ Picante</li>
          <li>Chick-Fil-A</li>
          <li>Teriyaki</li>
        </ul>
      </section>

      <p className="text-sm text-gray-400 mb-6">* El costo de envío se coordina por WhatsApp y es aparte del combo.</p>

      <a
        href="https://wa.me/5492212237267"
        className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl shadow-xl text-lg"
        target="_blank"
        rel="noopener noreferrer"
      >
        Hacer pedido por WhatsApp
      </a>
    </div>
  );
}
