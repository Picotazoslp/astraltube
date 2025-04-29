import React, { useState } from "react";

export default function App() {
  const [selectedCombo, setSelectedCombo] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [form, setForm] = useState({
    salsas: [],
    papa: "",
    sede: "",
    tipoEntrega: "",
    dips: false,
  });

  const combos = [
    {
      nombre: "Personal",
      descripcion: "6 alitas, hasta 2 salsas, 1 porción de papas",
      imagen: "/combo-personal.jpg.png",
      precio: 5600,
      salsas: 2,
      papas: 1,
    },
    {
      nombre: "Para 2",
      descripcion: "12 alitas, hasta 2 salsas, 2 porciones de papas",
      imagen: "/combo-dos.jpg.png",
      precio: 8500,
      salsas: 2,
      papas: 2,
    },
    {
      nombre: "Familiar",
      descripcion: "30 alitas, hasta 5 salsas, 5 porciones de papas",
      imagen: "/combo-familiar.jpg.png",
      precio: 20000,
      salsas: 5,
      papas: 5,
    },
  ];

  const todasSalsas = ["BBQ", "Miel mostaza", "Buffalo", "Ajo parmesano", "Teriyaki"];
  const tiposPapas = ["Comunes", "Con cáscara"];
  const sedes = ["Av. 7 y 459", "Av. 13 y 61"];
  const tiposEntrega = ["Take away", "Delivery"];

  const handleSalsaChange = (salsa) => {
    const selected = form.salsas.includes(salsa)
      ? form.salsas.filter((s) => s !== salsa)
      : [...form.salsas, salsa];
    if (selected.length <= selectedCombo.salsas) {
      setForm({ ...form, salsas: selected });
    }
  };

  function agregarAlCarrito() {
    const total = selectedCombo.precio + (form.dips ? 300 : 0);
    setCarrito([...carrito, { combo: selectedCombo, seleccion: form, total }]);
    alert("Combo agregado al carrito");
    setSelectedCombo(null);
    setForm({
      salsas: [],
      papa: "",
      sede: "",
      tipoEntrega: "",
      dips: false,
    });
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-4 font-sans">
      <h1 className="text-4xl font-bold text-yellow-400 mb-2">🔥 Picotazos LP</h1>
      <p className="mb-6 text-lg">¡Elegí tu combo y hacé tu pedido por WhatsApp!</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {combos.map((combo) => (
          <div
            key={combo.nombre}
            className="bg-zinc-800 rounded-xl shadow p-2 cursor-pointer hover:ring-2 ring-yellow-400"
            onClick={() => setSelectedCombo(combo)}
          >
            <img src={combo.imagen} alt={combo.nombre} className="rounded-xl mb-2" />
            <h2 className="text-xl font-semibold">{combo.nombre}</h2>
            <p className="text-sm">{combo.descripcion}</p>
            <p className="text-yellow-400 font-bold mt-1">${combo.precio}</p>
          </div>
        ))}
      </div>

      {selectedCombo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-800 rounded-xl p-4 w-full max-w-md space-y-3">
            <h2 className="text-2xl font-bold">{selectedCombo.nombre}</h2>
            <p className="text-sm">{selectedCombo.descripcion}</p>

            <div>
              <label className="font-semibold">Salsas (máx {selectedCombo.salsas}):</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {todasSalsas.map((salsa) => (
                  <label key={salsa} className="text-sm">
                    <input
                      type="checkbox"
                      checked={form.salsas.includes(salsa)}
                      onChange={() => handleSalsaChange(salsa)}
                      className="mr-1"
                    />
                    {salsa}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="font-semibold">Tipo de papas:</label>
              <select
                className="w-full mt-1 p-2 rounded bg-zinc-700 text-white"
                value={form.papa}
                onChange={(e) => setForm({ ...form, papa: e.target.value })}
              >
                <option value="">Elegí una opción</option>
                {tiposPapas.map((papa) => (
                  <option key={papa}>{papa}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold">¿Agregar dip? (+$300)</label>
              <input
                type="checkbox"
                className="ml-2"
                checked={form.dips}
                onChange={(e) => setForm({ ...form, dips: e.target.checked })}
              />
            </div>

            <div>
              <label className="font-semibold">Sede:</label>
              <select
                className="w-full mt-1 p-2 rounded bg-zinc-700 text-white"
                value={form.sede}
                onChange={(e) => setForm({ ...form, sede: e.target.value })}
              >
                <option value="">Elegí una sede</option>
                {sedes.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold">Tipo de entrega:</label>
              <select
                className="w-full mt-1 p-2 rounded bg-zinc-700 text-white"
                value={form.tipoEntrega}
                onChange={(e) => setForm({ ...form, tipoEntrega: e.target.value })}
              >
                <option value="">Elegí una opción</option>
                {tiposEntrega.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-between mt-4">
              <button
                onClick={() => setSelectedCombo(null)}
                className="bg-red-500 px-4 py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={agregarAlCarrito}
                className="bg-yellow-500 px-4 py-2 rounded text-black font-bold"
              >
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
