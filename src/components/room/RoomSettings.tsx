"use client";

import { useState, useEffect } from "react";
import { getRoomSettings, updateRoomSettings } from "@/lib/firebase/settings";

interface RoomSettingsProps {
  roomId: string;
}

export default function RoomSettings({ roomId }: RoomSettingsProps) {
  const [settings, setSettings] = useState({
    enableAdvancedAssignments: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const roomSettings = await getRoomSettings(roomId);
      if (roomSettings) {
        setSettings({
          enableAdvancedAssignments: roomSettings.enableAdvancedAssignments || false,
        });
      }
      setLoading(false);
    };
    loadSettings();
  }, [roomId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateRoomSettings(roomId, settings);
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Save settings error:", error);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading settings...</div>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Room Settings</h3>

      <div className="space-y-4">
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.enableAdvancedAssignments}
              onChange={(e) => setSettings(prev => ({ ...prev, enableAdvancedAssignments: e.target.checked }))}
              className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-slate-700">Enable Advanced Assignments</span>
          </label>
          <p className="text-xs text-slate-500 mt-1">
            Enable submission tracking, deadlines, AI evaluation, and color-coded task status.
          </p>
        </div>

        <div className="pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}