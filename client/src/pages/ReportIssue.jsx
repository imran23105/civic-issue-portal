import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { ToastContainer } from "react-toastify";
import { handleSuccess } from "../Utils";
import { useNavigate } from "react-router-dom";

/* 📍 Fixed Center Pin */
const CenterPin = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
    <img
      src="https://cdn-icons-png.flaticon.com/512/684/684908.png"
      alt="pin"
      className="w-8 h-8 -translate-y-4"
    />
  </div>
);

/* 🧭 Update form when map moves */
function MapCenterUpdater({ setForm }) {
  const map = useMapEvents({
    moveend: async () => {
      const center = map.getCenter();
      const lat = center.lat;
      const lng = center.lng;

      const res = await fetch(
        `http://localhost:8080/api/location/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();

      setForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        address: data.display_name || "",
        city:
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          "",
        state: data.address?.state || "",
      }));
    },
  });

  return null;
}

/* 🔹 Leaflet marker fix */
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const categories = [
  "Garbage",
  "Water Leak",
  "Road Safety",
  "Pothole",
  "Streetlight",
  "Other",
];

export default function ReportIssue() {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: categories[0],
    image: null,
    latitude: "",
    longitude: "",
    address: "",
    city: "",
    state: "",
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageAnalyzed, setImageAnalyzed] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";

  /* 📍 Live GPS Location */
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const res = await fetch(
        `http://localhost:8080/api/location/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();

      setForm((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
        address: data.display_name || "",
        city:
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          "",
        state: data.address?.state || "",
      }));
    });
  }, []);

  /* 🧹 Image preview cleanup */
  useEffect(
    () => () => imagePreview && URL.revokeObjectURL(imagePreview),
    [imagePreview]
  );

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setAiLoading(true);

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch("http://localhost:8080/api/vision/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const data = await res.json();

      setForm((p) => ({
        ...p,
        image: data.imageUrl,
        title: data.title || p.title,
        description: data.description || p.description,
        category: data.category || p.category,
      }));

      setImageAnalyzed(true);
    } catch (err) {
      console.error("Vision API failed", err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      alert("Session expired. Please login again.");
      return;
    }

    if (!form.title.trim()) return handleSuccess("Please enter issue title");
    if (!form.description.trim())
      return handleSuccess("Please enter issue description");

    setSubmitting(true);

    try {
      const res = await fetch("http://localhost:8080/api/issues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Submission failed");

      handleSuccess("Issue reported successfully!");
      setTimeout(() => navigate("/user/dashboard"), 1000);
    } catch (err) {
      console.error(err);
      handleSuccess("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-blue-50 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-extrabold text-center text-blue-700 mb-2">
          🚨 Report Civic Issue
        </h1>
        <p className="text-center text-gray-500 mb-8">
          AI-assisted civic issue reporting with live GPS
        </p>

        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Issue Title
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500"
              placeholder="Eg: Garbage near main road"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Issue Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows="4"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500"
              placeholder="Explain the issue clearly..."
              required
            />
          </div>

          {/* City / State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              value={form.city}
              readOnly
              className="rounded-lg bg-gray-100 px-4 py-3 border"
            />
            <input
              value={form.state}
              readOnly
              className="rounded-lg bg-gray-100 px-4 py-3 border"
            />
          </div>

          {/* Address */}
          <input
            value={form.address}
            readOnly
            className="w-full rounded-lg bg-gray-100 px-4 py-3 border"
          />

          {/* Upload */}
          <div className="border-2 border-dashed rounded-xl p-5 text-center bg-gray-50">
            <p className="font-semibold mb-2">Upload Issue Photo</p>
            <input
              type="file"
              onChange={handleImageChange}
              className="block w-full text-sm file:bg-blue-600 file:text-white file:px-4 file:py-2 file:rounded-lg"
            />
          </div>

          {imagePreview && (
            <div className="flex justify-center">
              <img
                src={imagePreview}
                alt="preview"
                className="max-h-48 rounded-xl border shadow"
              />
            </div>
          )}

          {/* Map */}
          <div className="relative h-72 rounded-xl overflow-hidden border">
            {form.latitude && form.longitude && (
              <>
                <MapContainer
                  center={[Number(form.latitude), Number(form.longitude)]}
                  zoom={16}
                  scrollWheelZoom
                  className="h-full w-full"
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <MapCenterUpdater setForm={setForm} />
                </MapContainer>
                <CenterPin />
              </>
            )}
          </div>

          <button
            disabled={submitting}
            className="w-full bg-blue-600 disabled:bg-gray-400 hover:bg-blue-700 transition text-white py-3 rounded-full font-bold text-lg"
          >
            {submitting ? "Submitting..." : "Submit Issue"}
          </button>
        </form>
      </div>
      <ToastContainer />
    </div>
  );
}
