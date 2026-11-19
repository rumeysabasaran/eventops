import { HashRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from './context/DataContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import CityIntelligence from './pages/CityIntelligence'
import MapPage from './pages/MapPage'
import Opportunities from './pages/Opportunities'
import DataSources from './pages/DataSources'
import ScraperMonitoring from './pages/ScraperMonitoring'

export default function App() {
  return (
    <HashRouter>
      <DataProvider>
        <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="city-intelligence" element={<CityIntelligence />} />
          <Route path="map" element={<MapPage />} />
          <Route path="parking-opportunities" element={<Opportunities service="parking" />} />
          <Route path="scooter-opportunities" element={<Opportunities service="scooter" />} />
          <Route path="data-sources" element={<DataSources />} />
          <Route path="scraper-monitoring" element={<ScraperMonitoring />} />
        </Route>
        </Routes>
      </DataProvider>
    </HashRouter>
  )
}
