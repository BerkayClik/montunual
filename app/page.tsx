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

    // Log the parameters being sent to the API
    console.log('Fetching weather data with parameters:', params)

    // Make the API call
    const response = await fetch(`${url}?latitude=${lat}&longitude=${lon}&current=${params.current.join(',')}`)

    // Check if the response is okay
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    // Parse the JSON response
    const data = await response.json()

    // Log the entire response data for debugging
    console.log('API Response:', data)

    // Access the current weather data
    const current = data.current

    // Ensure the current data is valid
    if (!current) {
      throw new Error("Invalid weather data structure")
    }

    // Extract the weather variables
    const temperature = current.temperature_2m ?? 0
    const precipitation = current.precipitation ?? 0
    const windSpeed = current.windspeed_10m ?? 0
    const humidity = current.relativehumidity_2m ?? 0

    // Calculate perceived temperature
    let perceivedTemp = Math.round(temperature) // Default to actual temperature

    // Calculate wind chill if temperature is below 10°C
    if (temperature < 10) {
      perceivedTemp = Math.round(
        13.12 + 0.6215 * temperature - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temperature * Math.pow(windSpeed, 0.16)
      )
    }

    // Calculate heat index if temperature is above 27°C
    if (temperature > 27) {
      const e = (humidity / 100) * 6.11 * Math.pow(10, (7.5 * temperature) / (237.7 + temperature))
      perceivedTemp = Math.round(temperature + 0.5555 * (e - 10))
    }

    return {
      temperature: Math.round(temperature),
      isRainy: precipitation > 0,
      windSpeed: Math.round(windSpeed),
      humidity: Math.round(humidity),
      hour: new Date().getHours(),
      perceivedTemp: perceivedTemp // Use the calculated perceived temperature
    }
  } catch (error) {
    console.error('Weather API error:', error)
    throw new Error('Failed to fetch weather data')
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
          setLocation({ lat, lon })
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
        {/* Static explanation of the coat decision algorithm */}
        <div className="text-center mt-4">
          <h3 className="text-lg font-semibold">How the Decision is Made:</h3>
          <p>
            The decision to take a coat is based on the following criteria:
          </p>
          <ul className="list-disc list-inside">
            <li>If the perceived temperature is below 15°C, it is considered cold.</li>
            <li>If it is raining, you should take a coat.</li>
            <li>If the wind speed exceeds {HIGH_WIND_THRESHOLD} km/h, it is considered windy.</li>
            <li>If it is night time (before 6 AM or after 6 PM), and the perceived temperature is below 18°C, you should take a coat.</li>
          </ul>
          <p>
            If any of these conditions are true, it is recommended to take your coat.
          </p>
        </div>
      </Card>
    </div>
  )
}
