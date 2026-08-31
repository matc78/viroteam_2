"use client";

import { useRef, useState } from "react";
import type { PracticeLocation } from "@/lib/clubSetup/clubSetupDraft";
import { ClubSetupUi } from "@/lib/clubSetup/clubSetupUi";
import {
  searchFrenchCities,
  searchFrenchStreets,
  type FrenchAddressSuggestion,
} from "@/lib/clubSetup/frenchAddressService";
import { PracticeLocationChip } from "@/components/clubSetup/PracticeLocationChip";
import { SetupCard } from "@/components/clubSetup/SetupCard";
import fieldStyles from "@/components/clubSetup/SetupFields.module.css";
import styles from "./LocationStep.module.css";

type LocationStepProps = {
  city: string;
  postalCode: string;
  address: string;
  locations: PracticeLocation[];
  useClubAddressAsFirstLocation: boolean;
  onCityChange: (city: string) => void;
  onPostalCodeChange: (postalCode: string) => void;
  onAddressChange: (address: string) => void;
  onUseClubAddressChanged: (value: boolean) => void;
  onAddLocation: (location: PracticeLocation) => void;
  onRemoveLocation: (index: number) => void;
};

const headquartersAccent = "var(--color-sport-cyan)";
const practiceAccent = "var(--color-sport-orange)";

/** Étape localisation — adresse du club et lieux de pratique. */
export function LocationStep({
  city,
  postalCode,
  address,
  locations,
  useClubAddressAsFirstLocation,
  onCityChange,
  onPostalCodeChange,
  onAddressChange,
  onUseClubAddressChanged,
  onAddLocation,
  onRemoveLocation,
}: LocationStepProps) {
  const [citySuggestions, setCitySuggestions] = useState<FrenchAddressSuggestion[]>([]);
  const [streetSuggestions, setStreetSuggestions] = useState<FrenchAddressSuggestion[]>([]);
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const cityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleCitySearch(query: string) {
    if (cityTimerRef.current) clearTimeout(cityTimerRef.current);
    cityTimerRef.current = setTimeout(async () => {
      const results = await searchFrenchCities(query);
      setCitySuggestions(results);
    }, 250);
  }

  function scheduleStreetSearch(query: string) {
    if (streetTimerRef.current) clearTimeout(streetTimerRef.current);
    streetTimerRef.current = setTimeout(async () => {
      const results = await searchFrenchStreets({
        query,
        city,
        postalCode,
      });
      setStreetSuggestions(results);
    }, 250);
  }

  function applyCitySuggestion(suggestion: FrenchAddressSuggestion) {
    onCityChange(suggestion.city);
    if (suggestion.postalCode) onPostalCodeChange(suggestion.postalCode);
    setCitySuggestions([]);
  }

  function applyStreetSuggestion(suggestion: FrenchAddressSuggestion) {
    onAddressChange(suggestion.street || suggestion.label);
    if (suggestion.postalCode) onPostalCodeChange(suggestion.postalCode);
    if (suggestion.city) onCityChange(suggestion.city);
    setStreetSuggestions([]);
  }

  function handleAddLocation() {
    const name = locationName.trim();
    if (!name) return;
    onAddLocation({
      name,
      address: locationAddress.trim() || undefined,
    });
    setLocationName("");
    setLocationAddress("");
  }

  const hasStreetAddress = address.trim().length > 0;

  return (
    <div className={styles.grid}>
        <SetupCard accent={headquartersAccent} className={styles.panel}>
          <h3 className={styles.panelTitle}>
            <span aria-hidden>📍</span> Siège du club
          </h3>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>Ville</span>
            <div className={fieldStyles.fieldWrap}>
              <input
                className={fieldStyles.input}
                style={{ ["--field-accent" as string]: headquartersAccent } as React.CSSProperties}
                value={city}
                onChange={(event) => {
                  onCityChange(event.target.value);
                  scheduleCitySearch(event.target.value);
                }}
              />
              {citySuggestions.length > 0 ? (
                <div className={fieldStyles.suggestions}>
                  {citySuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      className={fieldStyles.suggestionItem}
                      onClick={() => applyCitySuggestion(suggestion)}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>Code postal</span>
            <input
              className={fieldStyles.input}
              style={{ ["--field-accent" as string]: headquartersAccent } as React.CSSProperties}
              value={postalCode}
              onChange={(event) => onPostalCodeChange(event.target.value)}
            />
          </label>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>Adresse du club</span>
            <div className={fieldStyles.fieldWrap}>
              <input
                className={fieldStyles.input}
                style={{ ["--field-accent" as string]: headquartersAccent } as React.CSSProperties}
                value={address}
                onChange={(event) => {
                  onAddressChange(event.target.value);
                  scheduleStreetSearch(event.target.value);
                }}
              />
              {streetSuggestions.length > 0 ? (
                <div className={fieldStyles.suggestions}>
                  {streetSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      className={fieldStyles.suggestionItem}
                      onClick={() => applyStreetSuggestion(suggestion)}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>
          <label className={fieldStyles.checkboxRow}>
            <input
              type="checkbox"
              checked={useClubAddressAsFirstLocation}
              disabled={!hasStreetAddress}
              onChange={(event) => onUseClubAddressChanged(event.target.checked)}
            />
            Utiliser l&apos;adresse du club comme lieu de pratique
          </label>
        </SetupCard>

        <SetupCard accent={practiceAccent} className={styles.panel}>
          <h3 className={styles.panelTitle}>
            <span aria-hidden>⚽</span> Lieux de pratique
          </h3>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>Nom du lieu</span>
            <input
              className={fieldStyles.input}
              style={{ ["--field-accent" as string]: practiceAccent } as React.CSSProperties}
              value={locationName}
              placeholder="Ex. Stade municipal"
              onChange={(event) => setLocationName(event.target.value)}
            />
          </label>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>Adresse du lieu (optionnel)</span>
            <input
              className={fieldStyles.input}
              style={{ ["--field-accent" as string]: practiceAccent } as React.CSSProperties}
              value={locationAddress}
              placeholder="Si différente du siège"
              onChange={(event) => setLocationAddress(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.addButton}
            style={{ background: practiceAccent }}
            disabled={!locationName.trim()}
            onClick={handleAddLocation}
          >
            Ajouter ce lieu
          </button>
          {locations.length > 0 ? (
            <div className={styles.locationsWrap}>
              {locations.map((location, index) => (
                <PracticeLocationChip
                  key={`${location.name}-${index}`}
                  location={location}
                  accent={
                    ClubSetupUi.sportAccents[index % ClubSetupUi.sportAccents.length]
                  }
                  onRemove={() => onRemoveLocation(index)}
                />
              ))}
            </div>
          ) : null}
        </SetupCard>
    </div>
  );
}
