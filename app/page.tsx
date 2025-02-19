"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchWeatherApi } from "openmeteo"

// Constants for weather calculations
const HIGH_WIND_THRESHOLD = 20 // km/h
const HIGH_HUMIDITY_THRESHOLD = 70 // percentage
const MORNING_HOUR = 6
const EVENING_HOUR = 18

interface WeatherData {
  temperature: number
  isRainy: boolean
  windSpeed: number
  humidity: number
  hour: number
  perceivedTemp: number
}

interface LocationData {
  lat: number
  lon: number
  name: string
}

// Add this interface for the geocoding API response
interface GeocodingResult {
  results?: Array<{
    name: string
    admin3?: string
    admin1?: string
    country?: string
  }>
}

async function getWeatherForecast(lat: number, lon: number): Promise<WeatherData> {
  try {
    const url = "https://api.open-meteo.com/v1/forecast"
    const params = {
      latitude: lat,
      longitude: lon,
      current: [
        "temperature_2m",
        "precipitation",
        "windspeed_10m",
        "relativehumidity_2m",
        "is_day"
      ]
    }

    const responses = await fetchWeatherApi(url, params)
    const response = responses[0]
    const current = response.current()

    if (!current) {
      throw new Error("No weather data available")
    }

    // Safely extract weather data with null checks
    const variables = current.variables()
    if (!variables || variables.length < 4) {
      throw new Error("Incomplete weather data")
    }

    // Extract base weather data with safe access
    const temperature = variables[0]?.value() ?? 0
    const precipitation = variables[1]?.value() ?? 0
    const windSpeed = variables[2]?.value() ?? 0
    const humidity = variables[3]?.value() ?? 0
    
    // Get current hour
    const currentHour = new Date().getHours()

    // Calculate perceived temperature
    let perceivedTemp = temperature

    // Wind chill adjustment (using simplified wind chill formula)
    if (windSpeed > HIGH_WIND_THRESHOLD) {
      perceivedTemp -= (windSpeed - HIGH_WIND_THRESHOLD) * 0.1
    }

    // Humidity adjustment
    if (humidity > HIGH_HUMIDITY_THRESHOLD) {
      if (temperature > 20) {
        // Hot weather feels hotter with high humidity
        perceivedTemp += (humidity - HIGH_HUMIDITY_THRESHOLD) * 0.1
      } else {
        // Cold weather feels colder with high humidity
        perceivedTemp -= (humidity - HIGH_HUMIDITY_THRESHOLD) * 0.05
      }
    }

    // Time of day adjustment
    if (currentHour < MORNING_HOUR || currentHour > EVENING_HOUR) {
      perceivedTemp -= 2 // It feels colder in the early morning and late evening
    }

    return {
      temperature: Math.round(temperature),
      isRainy: precipitation > 0,
      windSpeed: Math.round(windSpeed),
      humidity: Math.round(humidity),
      hour: currentHour,
      perceivedTemp: Math.round(perceivedTemp)
    }
  } catch (error) {
    console.error('Weather API error:', error)
    throw new Error('Failed to fetch weather data')
  }
}

async function getLocationName(lat: number, lon: number): Promise<string> {
  try {
    // Add timeout to fetch
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en`,
      { 
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      }
    )
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Geocoding API failed with status: ${response.status}`)
    }

    const data = await response.json() as GeocodingResult
    
    if (data.results?.[0]) {
      const location = data.results[0]
      // Try different combinations of location data
      const locationParts = []

      if (location.name) locationParts.push(location.name)
      if (location.admin3) locationParts.push(location.admin3)
      if (location.admin1) locationParts.push(location.admin1)
      if (locationParts.length === 0 && location.country) locationParts.push(location.country)

      if (locationParts.length > 0) {
        // Return up to two most specific parts
        return locationParts.slice(0, 2).join(', ')
      }
    }
    
    // More user-friendly coordinate format
    const latDir = lat >= 0 ? 'N' : 'S'
    const lonDir = lon >= 0 ? 'E' : 'W'
    return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`

  } catch (error) {
    console.error('Geocoding error:', error)
    
    // Handle specific error types
    if (error instanceof TypeError) {
      console.error('Network error when fetching location data')
    } else if (error.name === 'AbortError') {
      console.error('Geocoding request timed out')
    }

    // Return formatted coordinates as fallback
    const latDir = lat >= 0 ? 'N' : 'S'
    const lonDir = lon >= 0 ? 'E' : 'W'
    return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`
  }
}

export default function Home() {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getLocation = () => {
    setLoading(true)
    setError(null)
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lon = position.coords.longitude
          const name = await getLocationName(lat, lon)
          setLocation({
            lat,
            lon,
            name
          })
        },
        (error) => {
          setError("Unable to retrieve your location")
          setLoading(false)
        },
      )
    } else {
      setError("Geolocation is not supported by your browser")
      setLoading(false)
    }
  }

  useEffect(() => {
    if (location) {
      getWeatherForecast(location.lat, location.lon)
        .then(setWeather)
        .catch(() => setError("Failed to fetch weather data"))
        .finally(() => setLoading(false))
    }
  }, [location])

  const shouldTakeCoat = () => {
    if (!weather) return false
    
    // Enhanced decision making
    const conditions = {
      isCold: weather.perceivedTemp < 15,
      isRainy: weather.isRainy,
      isWindy: weather.windSpeed > HIGH_WIND_THRESHOLD,
      isNightTime: weather.hour < MORNING_HOUR || weather.hour > EVENING_HOUR
    }

    // Take coat if any of these conditions are true
    return conditions.isCold || conditions.isRainy || 
           (conditions.isWindy && weather.perceivedTemp < 20) ||
           (conditions.isNightTime && weather.perceivedTemp < 18)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Should You Take Your Coat?</CardTitle>
          <CardDescription>Find out if you need a coat based on your location's weather</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          {!location && !loading && (
            <Button onClick={getLocation} className="w-full">
              Get My Location
            </Button>
          )}
          {loading && <p>Loading...</p>}
          {weather && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Weather in {location?.name}
              </p>
              <p className="text-2xl font-bold mb-2">
                {shouldTakeCoat() ? "Yes, take your coat!" : "No, you don't need a coat!"}
              </p>
              <p>Temperature: {weather.temperature}°C</p>
              <p>Feels like: {weather.perceivedTemp}°C</p>
              <p>Wind Speed: {weather.windSpeed} km/h</p>
              <p>Humidity: {weather.humidity}%</p>
              <p>{weather.isRainy ? "It might rain" : "No rain expected"}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {location && (
            <Button onClick={getLocation} variant="outline">
              Check Again
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

