import React, { useEffect, useState } from 'react';
import { fetchSettings, updateSettings } from '../utils/api';
import { useToast } from '../components/Toast';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    factoryName: '',
    managerName: '',
    defaultSamplingPlan: '',
    commonMaterials: [],
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchSettings().then(data => {
      if (!data.error) {
        setSettings(data);
      }
      setLoaded(true);
    });
  }, []);

  const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  async function handleSave() {
    setSaving(true);
    const result = await updateSettings(settings);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSettings(result);
    toast.success('ההגדרות נשמרו בהצלחה');
  }

  if (!loaded) return <div className="p-8 text-gray-400">טוען...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">הגדרות</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 space-y-6">
        <div>
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">פרטי מפעל</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">שם המפעל</label>
              <input
                type="text"
                value={settings.factoryName}
                onChange={e => set('factoryName', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">שם מנהל האיכות</label>
              <input
                type="text"
                value={settings.managerName}
                onChange={e => set('managerName', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">ברירות מחדל</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">תוכנית דגימה ברירת מחדל</label>
            <input
              type="text"
              value={settings.defaultSamplingPlan}
              onChange={e => set('defaultSamplingPlan', e.target.value)}
              placeholder="לדוגמה: MIL-STD-1916 Level I"
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
            />
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">חומרים נפוצים</h2>
          <p className="text-xs text-gray-400 mb-2">רשימת חומרים מופרדת בפסיקים (ישמש בטפסים)</p>
          <textarea
            value={(settings.commonMaterials || []).join(', ')}
            onChange={e => set('commonMaterials', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            rows={3}
            placeholder="NBR 70 Shore A, EPDM 60 Shore A, Silicone 50 Shore A, FKM 75 Shore A"
            className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
          />
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">אודות המערכת</h3>
          <p className="text-xs text-gray-400">
            מערכת ניהול הזמנות ובקרת איכות למפעל גומי. גרסה 2.0.
            <br />
            המערכת מבוססת על עיקרון שלמות הנתונים — אינה ממציאה ערכים ומשתמשת רק בנתונים שסופקו על ידי המשתמש או חולצו ממסמכים.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-gray-800 dark:bg-gray-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? 'שומר...' : 'שמור הגדרות'}
        </button>
      </div>
    </div>
  );
}
