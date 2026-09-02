/**
 * JARVIS 12.0 - Utility Tools
 * 
 * Outils utilitaires : météo, calculs de dates, conversions.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { ToolResult } from "../tools-executor.ts";

interface ToolContext {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * Récupère la météo pour une ville (API Open-Meteo gratuite)
 */
export async function executeGetWeather(
  ctx: ToolContext,
  args: {
    city: string;
    country?: string;
    days?: number;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    // Géocodage via Nominatim (gratuit)
    const searchQuery = args.country 
      ? `${args.city}, ${args.country}`
      : args.city;

    const geoResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'Marque-IA-Jarvis/1.0'
        }
      }
    );

    const geoData = await geoResponse.json();
    
    if (!geoData || geoData.length === 0) {
      return {
        success: false,
        error: `Ville "${args.city}" non trouvée`,
        execution_time_ms: Date.now() - start
      };
    }

    const { lat, lon, display_name } = geoData[0];
    const days = Math.min(args.days || 3, 7);

    // Météo via Open-Meteo (gratuit, pas de clé API)
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&current_weather=true&timezone=Europe/Paris&forecast_days=${days}`
    );

    const weatherData = await weatherResponse.json();

    // Mapping des codes météo
    const weatherCodes: Record<number, string> = {
      0: '☀️ Ciel dégagé',
      1: '🌤️ Principalement dégagé',
      2: '⛅ Partiellement nuageux',
      3: '☁️ Couvert',
      45: '🌫️ Brouillard',
      48: '🌫️ Brouillard givrant',
      51: '🌧️ Bruine légère',
      53: '🌧️ Bruine modérée',
      55: '🌧️ Bruine dense',
      61: '🌧️ Pluie légère',
      63: '🌧️ Pluie modérée',
      65: '🌧️ Pluie forte',
      71: '🌨️ Neige légère',
      73: '🌨️ Neige modérée',
      75: '🌨️ Neige forte',
      80: '🌦️ Averses légères',
      81: '🌦️ Averses modérées',
      82: '🌦️ Averses violentes',
      95: '⛈️ Orage',
      96: '⛈️ Orage avec grêle légère',
      99: '⛈️ Orage avec grêle forte',
    };

    const current = weatherData.current_weather;
    const daily = weatherData.daily;

    const forecast = daily.time.map((date: string, i: number) => ({
      date,
      temp_max: daily.temperature_2m_max[i],
      temp_min: daily.temperature_2m_min[i],
      precipitation: daily.precipitation_sum[i],
      condition: weatherCodes[daily.weathercode[i]] || 'Inconnu',
    }));

    return {
      success: true,
      data: {
        location: display_name,
        coordinates: { lat, lon },
        current: {
          temperature: current.temperature,
          windspeed: current.windspeed,
          condition: weatherCodes[current.weathercode] || 'Inconnu',
        },
        forecast,
        units: {
          temperature: '°C',
          windspeed: 'km/h',
          precipitation: 'mm',
        },
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Récupération météo échouée',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Calculs de dates
 */
export async function executeCalculateDate(
  ctx: ToolContext,
  args: {
    operation: 'add' | 'subtract' | 'diff' | 'format' | 'workdays';
    date: string;
    date2?: string;
    amount?: number;
    unit?: 'days' | 'weeks' | 'months' | 'years' | 'hours' | 'minutes';
    format?: string;
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    const baseDate = new Date(args.date);
    
    if (isNaN(baseDate.getTime())) {
      return {
        success: false,
        error: `Date invalide: ${args.date}`,
        execution_time_ms: Date.now() - start
      };
    }

    let result: unknown;

    switch (args.operation) {
      case 'add':
      case 'subtract': {
        const amount = args.amount || 0;
        const multiplier = args.operation === 'subtract' ? -1 : 1;
        const unit = args.unit || 'days';
        
        const resultDate = new Date(baseDate);
        
        switch (unit) {
          case 'minutes':
            resultDate.setMinutes(resultDate.getMinutes() + (amount * multiplier));
            break;
          case 'hours':
            resultDate.setHours(resultDate.getHours() + (amount * multiplier));
            break;
          case 'days':
            resultDate.setDate(resultDate.getDate() + (amount * multiplier));
            break;
          case 'weeks':
            resultDate.setDate(resultDate.getDate() + (amount * 7 * multiplier));
            break;
          case 'months':
            resultDate.setMonth(resultDate.getMonth() + (amount * multiplier));
            break;
          case 'years':
            resultDate.setFullYear(resultDate.getFullYear() + (amount * multiplier));
            break;
        }
        
        result = {
          original_date: args.date,
          result_date: resultDate.toISOString(),
          result_formatted: resultDate.toLocaleDateString('fr-FR', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
          }),
          operation: `${args.operation} ${amount} ${unit}`,
        };
        break;
      }

      case 'diff': {
        if (!args.date2) {
          return {
            success: false,
            error: 'date2 requis pour calculer une différence',
            execution_time_ms: Date.now() - start
          };
        }
        
        const date2 = new Date(args.date2);
        if (isNaN(date2.getTime())) {
          return {
            success: false,
            error: `Date2 invalide: ${args.date2}`,
            execution_time_ms: Date.now() - start
          };
        }

        const diffMs = date2.getTime() - baseDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        const diffWeeks = Math.round(diffDays / 7);
        const diffMonths = Math.round(diffDays / 30.44);
        const diffYears = Math.round(diffDays / 365.25);

        result = {
          date1: args.date,
          date2: args.date2,
          difference: {
            days: diffDays,
            weeks: diffWeeks,
            months: diffMonths,
            years: diffYears,
            milliseconds: diffMs,
          },
          formatted: `${Math.abs(diffDays)} jours ${diffDays >= 0 ? 'après' : 'avant'}`,
        };
        break;
      }

      case 'format': {
        const options: Intl.DateTimeFormatOptions = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        };

        result = {
          original: args.date,
          iso: baseDate.toISOString(),
          locale_fr: baseDate.toLocaleDateString('fr-FR', options),
          timestamp: baseDate.getTime(),
          day_of_week: baseDate.toLocaleDateString('fr-FR', { weekday: 'long' }),
          is_weekend: baseDate.getDay() === 0 || baseDate.getDay() === 6,
        };
        break;
      }

      case 'workdays': {
        if (!args.date2) {
          return {
            success: false,
            error: 'date2 requis pour calculer les jours ouvrés',
            execution_time_ms: Date.now() - start
          };
        }
        
        const endDate = new Date(args.date2);
        let workdays = 0;
        const current = new Date(baseDate);
        
        while (current <= endDate) {
          const day = current.getDay();
          if (day !== 0 && day !== 6) {
            workdays++;
          }
          current.setDate(current.getDate() + 1);
        }

        result = {
          start_date: args.date,
          end_date: args.date2,
          workdays,
          calendar_days: Math.round((endDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        };
        break;
      }

      default:
        return {
          success: false,
          error: `Opération inconnue: ${args.operation}`,
          execution_time_ms: Date.now() - start
        };
    }

    return {
      success: true,
      data: result,
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Calcul de date échoué',
      execution_time_ms: Date.now() - start
    };
  }
}

/**
 * Conversions d'unités
 */
export async function executeConvertUnits(
  ctx: ToolContext,
  args: {
    value: number;
    from_unit: string;
    to_unit: string;
    category?: 'length' | 'weight' | 'temperature' | 'currency' | 'data';
  }
): Promise<ToolResult> {
  const start = Date.now();

  try {
    const conversions: Record<string, Record<string, number>> = {
      // Longueur (base: mètre)
      'm': { m: 1, km: 0.001, cm: 100, mm: 1000, mi: 0.000621371, ft: 3.28084, in: 39.3701 },
      'km': { m: 1000, km: 1, cm: 100000, mm: 1000000, mi: 0.621371, ft: 3280.84, in: 39370.1 },
      'cm': { m: 0.01, km: 0.00001, cm: 1, mm: 10, mi: 0.00000621371, ft: 0.0328084, in: 0.393701 },
      'mm': { m: 0.001, km: 0.000001, cm: 0.1, mm: 1, mi: 0.000000621371, ft: 0.00328084, in: 0.0393701 },
      'mi': { m: 1609.34, km: 1.60934, cm: 160934, mm: 1609340, mi: 1, ft: 5280, in: 63360 },
      'ft': { m: 0.3048, km: 0.0003048, cm: 30.48, mm: 304.8, mi: 0.000189394, ft: 1, in: 12 },
      'in': { m: 0.0254, km: 0.0000254, cm: 2.54, mm: 25.4, mi: 0.0000157828, ft: 0.0833333, in: 1 },
      
      // Poids (base: kg)
      'kg': { kg: 1, g: 1000, mg: 1000000, lb: 2.20462, oz: 35.274, t: 0.001 },
      'g': { kg: 0.001, g: 1, mg: 1000, lb: 0.00220462, oz: 0.035274, t: 0.000001 },
      'mg': { kg: 0.000001, g: 0.001, mg: 1, lb: 0.00000220462, oz: 0.000035274, t: 0.000000001 },
      'lb': { kg: 0.453592, g: 453.592, mg: 453592, lb: 1, oz: 16, t: 0.000453592 },
      'oz': { kg: 0.0283495, g: 28.3495, mg: 28349.5, lb: 0.0625, oz: 1, t: 0.0000283495 },
      't': { kg: 1000, g: 1000000, mg: 1000000000, lb: 2204.62, oz: 35274, t: 1 },
      
      // Données (base: byte)
      'B': { B: 1, KB: 0.001, MB: 0.000001, GB: 0.000000001, TB: 0.000000000001 },
      'KB': { B: 1000, KB: 1, MB: 0.001, GB: 0.000001, TB: 0.000000001 },
      'MB': { B: 1000000, KB: 1000, MB: 1, GB: 0.001, TB: 0.000001 },
      'GB': { B: 1000000000, KB: 1000000, MB: 1000, GB: 1, TB: 0.001 },
      'TB': { B: 1000000000000, KB: 1000000000, MB: 1000000, GB: 1000, TB: 1 },
    };

    // Température (conversion spéciale)
    if (['C', 'F', 'K', '°C', '°F'].includes(args.from_unit) || ['C', 'F', 'K', '°C', '°F'].includes(args.to_unit)) {
      const from = args.from_unit.replace('°', '');
      const to = args.to_unit.replace('°', '');
      
      let celsius: number;
      
      // Convertir vers Celsius d'abord
      if (from === 'C') celsius = args.value;
      else if (from === 'F') celsius = (args.value - 32) * 5/9;
      else if (from === 'K') celsius = args.value - 273.15;
      else throw new Error(`Unité de température inconnue: ${from}`);
      
      // Convertir de Celsius vers l'unité cible
      let result: number;
      if (to === 'C') result = celsius;
      else if (to === 'F') result = (celsius * 9/5) + 32;
      else if (to === 'K') result = celsius + 273.15;
      else throw new Error(`Unité de température inconnue: ${to}`);

      return {
        success: true,
        data: {
          original_value: args.value,
          original_unit: args.from_unit,
          converted_value: Math.round(result * 100) / 100,
          target_unit: args.to_unit,
          category: 'temperature',
        },
        execution_time_ms: Date.now() - start
      };
    }

    // Conversion standard
    const fromUnit = args.from_unit.toUpperCase();
    const toUnit = args.to_unit.toUpperCase();

    if (!conversions[fromUnit]) {
      return {
        success: false,
        error: `Unité source inconnue: ${args.from_unit}. Unités supportées: ${Object.keys(conversions).join(', ')}`,
        execution_time_ms: Date.now() - start
      };
    }

    if (!conversions[fromUnit][toUnit]) {
      return {
        success: false,
        error: `Conversion de ${args.from_unit} vers ${args.to_unit} non supportée`,
        execution_time_ms: Date.now() - start
      };
    }

    const factor = conversions[fromUnit][toUnit];
    const convertedValue = args.value * factor;

    return {
      success: true,
      data: {
        original_value: args.value,
        original_unit: args.from_unit,
        converted_value: Math.round(convertedValue * 1000000) / 1000000,
        target_unit: args.to_unit,
        conversion_factor: factor,
      },
      execution_time_ms: Date.now() - start
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Conversion échouée',
      execution_time_ms: Date.now() - start
    };
  }
}
