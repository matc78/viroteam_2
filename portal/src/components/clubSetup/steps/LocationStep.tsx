"use client";

import { useEffect, useRef, useState } from "react";
import type { PracticeLocation } from "@/lib/clubSetup/clubSetupDraft";
import { ClubSetupFormat } from "@/lib/clubSetup/clubSetupFormat";
import { PracticeLocationCategories } from "@/lib/clubSetup/constants";
import {
  searchFrenchCities,
  searchFrenchStreets,
  type FrenchAddressSuggestion,
} from "@/lib/clubSetup/frenchAddressService";
import {
  addressLineError,
  cityError,
  formatAddressLine,
  formatCity,
} from "@/lib/format/personDataFormat";
import { PracticeLocationChip } from "@/components/clubSetup/PracticeLocationChip";
import { SetupCard } from "@/components/clubSetup/SetupCard";
import fieldStyles from "@/components/clubSetup/SetupFields.module.css";
import styles from "./LocationStep.module.css";

type LocationStepProps = {
  city: string;
  postalCode: string;
  address: string;
  sport: string;
  locations: PracticeLocation[];
  useClubAddressAsFirstLocation: boolean;
  onCityChange: (city: string) => void;
  onPostalCodeChange: (postalCode: string) => void;
  onAddressChange: (address: string) => void;
  onUseClubAddressChanged: (value: boolean) => void;
  onAddLocation: (location: PracticeLocation) => void;
  onRemoveLocation: (index: number) => void;
};

type AutofillField =
  | "city"
  | "postalCode"
  | "address"
  | "practiceCity"
  | "practiceAddress";

const stepAccent = "var(--step-accent)";

/** Props anti-autofill Chrome (ignore souvent autoComplete="off" sur les adresses). */
const noBrowserAddressAutofill = {
  autoComplete: "one-time-code",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;

/** Étape localisation — adresse du club et lieux de pratique. */
export function LocationStep({
  city,
  postalCode,
  address,
  sport,
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
  const [practiceCitySuggestions, setPracticeCitySuggestions] = useState<
    FrenchAddressSuggestion[]
  >([]);
  const [practiceStreetSuggestions, setPracticeStreetSuggestions] = useState<
    FrenchAddressSuggestion[]
  >([]);
  const [locationCity, setLocationCity] = useState(city);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationCategory, setLocationCategory] = useState(
    PracticeLocationCategories.defaultForSport(sport),
  );
  const [locationCategoryCustom, setLocationCategoryCustom] = useState("");
  const [unlockedFields, setUnlockedFields] = useState<
    Partial<Record<AutofillField, boolean>>
  >({});
  const cityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const practiceCityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const practiceStreetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const citySearchAbortRef = useRef<AbortController | null>(null);
  const streetSearchAbortRef = useRef<AbortController | null>(null);
  const practiceCitySearchAbortRef = useRef<AbortController | null>(null);
  const practiceStreetSearchAbortRef = useRef<AbortController | null>(null);

  const categoriesForSport = PracticeLocationCategories.forSport(sport);
  const isOtherCategory =
    locationCategory === PracticeLocationCategories.other;

  useEffect(() => {
    const options = PracticeLocationCategories.forSport(sport);
    const nextDefault = PracticeLocationCategories.defaultForSport(sport);
    setLocationCategory((current) =>
      options.includes(current) ? current : nextDefault,
    );
    setLocationCategoryCustom("");
  }, [sport]);

  useEffect(() => {
    setLocationCity((current) => (current.trim() ? current : city));
  }, [city]);

  useEffect(() => {
    return () => {
      if (cityTimerRef.current) clearTimeout(cityTimerRef.current);
      if (streetTimerRef.current) clearTimeout(streetTimerRef.current);
      if (practiceCityTimerRef.current) clearTimeout(practiceCityTimerRef.current);
      if (practiceStreetTimerRef.current) {
        clearTimeout(practiceStreetTimerRef.current);
      }
      citySearchAbortRef.current?.abort();
      streetSearchAbortRef.current?.abort();
      practiceCitySearchAbortRef.current?.abort();
      practiceStreetSearchAbortRef.current?.abort();
    };
  }, []);

  function unlockField(field: AutofillField) {
    setUnlockedFields((current) =>
      current[field] ? current : { ...current, [field]: true },
    );
  }

  function scheduleCitySearch(query: string) {
    if (cityTimerRef.current) clearTimeout(cityTimerRef.current);
    cityTimerRef.current = setTimeout(() => {
      citySearchAbortRef.current?.abort();
      const controller = new AbortController();
      citySearchAbortRef.current = controller;
      void searchFrenchCities(query, controller.signal).then((results) => {
        if (controller.signal.aborted) return;
        setCitySuggestions(results);
      });
    }, 250);
  }

  function scheduleStreetSearch(query: string) {
    if (streetTimerRef.current) clearTimeout(streetTimerRef.current);
    streetTimerRef.current = setTimeout(() => {
      streetSearchAbortRef.current?.abort();
      const controller = new AbortController();
      streetSearchAbortRef.current = controller;
      void searchFrenchStreets({
        query,
        city,
        postalCode,
        signal: controller.signal,
      }).then((results) => {
        if (controller.signal.aborted) return;
        setStreetSuggestions(results);
      });
    }, 250);
  }

  function schedulePracticeCitySearch(query: string) {
    if (practiceCityTimerRef.current) clearTimeout(practiceCityTimerRef.current);
    practiceCityTimerRef.current = setTimeout(() => {
      practiceCitySearchAbortRef.current?.abort();
      const controller = new AbortController();
      practiceCitySearchAbortRef.current = controller;
      void searchFrenchCities(query, controller.signal).then((results) => {
        if (controller.signal.aborted) return;
        setPracticeCitySuggestions(results);
      });
    }, 250);
  }

  function schedulePracticeStreetSearch(query: string) {
    if (practiceStreetTimerRef.current) {
      clearTimeout(practiceStreetTimerRef.current);
    }
    practiceStreetTimerRef.current = setTimeout(() => {
      practiceStreetSearchAbortRef.current?.abort();
      const controller = new AbortController();
      practiceStreetSearchAbortRef.current = controller;
      void searchFrenchStreets({
        query,
        city: locationCity,
        signal: controller.signal,
      }).then((results) => {
        if (controller.signal.aborted) return;
        setPracticeStreetSuggestions(results);
      });
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

  function applyPracticeCitySuggestion(suggestion: FrenchAddressSuggestion) {
    setLocationCity(suggestion.city);
    setPracticeCitySuggestions([]);
  }

  function applyPracticeStreetSuggestion(suggestion: FrenchAddressSuggestion) {
    setLocationAddress(suggestion.street || suggestion.label);
    if (suggestion.city) setLocationCity(suggestion.city);
    setPracticeStreetSuggestions([]);
  }

  function handleAddLocation() {
    const practiceCity = locationCity.trim();
    const practiceAddress = locationAddress.trim();
    const customCategory = locationCategoryCustom.trim();
    if (!practiceCity || !practiceAddress || !locationCategory) return;
    if (isOtherCategory && !customCategory) return;
    if (cityError(practiceCity) || addressLineError(practiceAddress)) return;
    const formattedCity = formatCity(practiceCity);
    const formattedAddress = formatAddressLine(practiceAddress);
    onAddLocation({
      name: ClubSetupFormat.practiceLocationName({
        category: locationCategory,
        city: formattedCity,
        categoryCustom: isOtherCategory ? customCategory : undefined,
      }),
      city: formattedCity,
      address: formattedAddress,
      category: locationCategory,
      ...(isOtherCategory ? { categoryCustom: customCategory } : {}),
    });
    setLocationAddress("");
    setLocationCategoryCustom("");
    setLocationCategory(PracticeLocationCategories.defaultForSport(sport));
  }

  const canAddLocation =
    Boolean(locationCategory) &&
    locationCity.trim().length > 0 &&
    locationAddress.trim().length > 0 &&
    !cityError(locationCity) &&
    !addressLineError(locationAddress) &&
    (!isOtherCategory || locationCategoryCustom.trim().length > 0);

  const canLinkHeadquarters = city.trim().length > 0 || address.trim().length > 0;
  const fieldAccentStyle = {
    ["--field-accent" as string]: stepAccent,
  } as React.CSSProperties;

  return (
    <div className={styles.layout}>
      {/* Leurres : Chrome y dépose souvent l’autofill adresse perso avant nos champs. */}
      <div className={styles.autofillTrap} aria-hidden="true">
        <input tabIndex={-1} autoComplete="address-level2" defaultValue="" />
        <input tabIndex={-1} autoComplete="postal-code" defaultValue="" />
        <input tabIndex={-1} autoComplete="street-address" defaultValue="" />
      </div>

      <SetupCard
        accent={stepAccent}
        className={`${styles.panel} ${styles.headquartersPanel}`}
      >
        <h3 className={styles.panelTitle}>
          <span aria-hidden>📍</span> Siège du club
        </h3>
        <div className={fieldStyles.field}>
          <span className={fieldStyles.label} id="club-setup-city-label">
            Ville
          </span>
          <div className={fieldStyles.fieldWrap}>
            <input
              className={fieldStyles.input}
              style={fieldAccentStyle}
              name="clubSetupCity"
              aria-labelledby="club-setup-city-label"
              {...noBrowserAddressAutofill}
              readOnly={!unlockedFields.city}
              onFocus={() => unlockField("city")}
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
        </div>
        <div className={fieldStyles.field}>
          <span className={fieldStyles.label} id="club-setup-postal-label">
            Code postal
          </span>
          <input
            className={fieldStyles.input}
            style={fieldAccentStyle}
            name="clubSetupPostalCode"
            aria-labelledby="club-setup-postal-label"
            {...noBrowserAddressAutofill}
            inputMode="numeric"
            readOnly={!unlockedFields.postalCode}
            onFocus={() => unlockField("postalCode")}
            value={postalCode}
            onChange={(event) => onPostalCodeChange(event.target.value)}
          />
        </div>
        <div className={fieldStyles.field}>
          <span className={fieldStyles.label} id="club-setup-address-label">
            Adresse du club
          </span>
          <div className={fieldStyles.fieldWrap}>
            <input
              className={fieldStyles.input}
              style={fieldAccentStyle}
              name="clubSetupAddress"
              aria-labelledby="club-setup-address-label"
              {...noBrowserAddressAutofill}
              readOnly={!unlockedFields.address}
              onFocus={() => unlockField("address")}
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
                    {suggestion.isSportsVenue ? (
                      <span className={fieldStyles.suggestionMeta}>Lieu sportif</span>
                    ) : null}
                    {suggestion.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </SetupCard>

      <div className={styles.bridge}>
        <label
          className={[
            styles.bridgeToggle,
            useClubAddressAsFirstLocation ? styles.bridgeToggleActive : "",
            !canLinkHeadquarters && !useClubAddressAsFirstLocation
              ? styles.bridgeToggleDisabled
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <input
            type="checkbox"
            className={styles.bridgeCheckbox}
            checked={useClubAddressAsFirstLocation}
            disabled={!canLinkHeadquarters && !useClubAddressAsFirstLocation}
            onChange={(event) => onUseClubAddressChanged(event.target.checked)}
          />
          <span className={styles.bridgeCheckmark} aria-hidden />
          <span className={styles.bridgeCopy}>
            <span className={styles.bridgeTitle}>Siège = lieu de pratique</span>
            <span className={styles.bridgeHint}>
              {useClubAddressAsFirstLocation
                ? "Adresse du club ajoutée"
                : "Cocher pour l’ajouter"}
            </span>
          </span>
        </label>
      </div>

      <SetupCard
        accent={stepAccent}
        className={`${styles.panel} ${styles.practicePanel}`}
      >
        <h3 className={styles.panelTitle}>
          <span aria-hidden>⚽</span> Lieux de pratique
        </h3>
        <div className={styles.practiceFields}>
          <div className={`${fieldStyles.field} ${styles.compactField}`}>
            <span
              className={`${fieldStyles.label} ${styles.compactLabel}`}
              id="club-setup-location-category-label"
            >
              Catégorie
            </span>
            <select
              className={`${fieldStyles.select} ${styles.compactInput}`}
              style={fieldAccentStyle}
              name="clubSetupLocationCategory"
              aria-labelledby="club-setup-location-category-label"
              value={locationCategory}
              onChange={(event) => {
                setLocationCategory(event.target.value);
                if (event.target.value !== PracticeLocationCategories.other) {
                  setLocationCategoryCustom("");
                }
              }}
            >
              {categoriesForSport.map((category) => (
                <option key={category} value={category}>
                  {PracticeLocationCategories.label(category)}
                </option>
              ))}
            </select>
          </div>
          <div className={`${fieldStyles.field} ${styles.compactField}`}>
            <span
              className={`${fieldStyles.label} ${styles.compactLabel}`}
              id="club-setup-location-city-label"
            >
              Ville
            </span>
            <div className={fieldStyles.fieldWrap}>
              <input
                className={`${fieldStyles.input} ${styles.compactInput}`}
                style={fieldAccentStyle}
                name="clubSetupPracticeCity"
                aria-labelledby="club-setup-location-city-label"
                {...noBrowserAddressAutofill}
                readOnly={!unlockedFields.practiceCity}
                onFocus={() => unlockField("practiceCity")}
                value={locationCity}
                placeholder="Ex. Viroflay"
                onChange={(event) => {
                  setLocationCity(event.target.value);
                  schedulePracticeCitySearch(event.target.value);
                }}
              />
              {practiceCitySuggestions.length > 0 ? (
                <div className={fieldStyles.suggestions}>
                  {practiceCitySuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      className={fieldStyles.suggestionItem}
                      onClick={() => applyPracticeCitySuggestion(suggestion)}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className={`${fieldStyles.field} ${styles.compactField}`}>
            <span
              className={`${fieldStyles.label} ${styles.compactLabel}`}
              id="club-setup-location-address-label"
            >
              Adresse
            </span>
            <div className={fieldStyles.fieldWrap}>
              <input
                className={`${fieldStyles.input} ${styles.compactInput}`}
                style={fieldAccentStyle}
                name="clubSetupPracticeAddress"
                aria-labelledby="club-setup-location-address-label"
                {...noBrowserAddressAutofill}
                readOnly={!unlockedFields.practiceAddress}
                onFocus={() => unlockField("practiceAddress")}
                value={locationAddress}
                placeholder="Ex. Stade des Bertisettes"
                onChange={(event) => {
                  setLocationAddress(event.target.value);
                  schedulePracticeStreetSearch(event.target.value);
                }}
              />
              {practiceStreetSuggestions.length > 0 ? (
                <div className={fieldStyles.suggestions}>
                  {practiceStreetSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      className={fieldStyles.suggestionItem}
                      onClick={() => applyPracticeStreetSuggestion(suggestion)}
                    >
                      {suggestion.isSportsVenue ? (
                        <span className={fieldStyles.suggestionMeta}>
                          Lieu sportif
                        </span>
                      ) : null}
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className={styles.addButton}
            disabled={!canAddLocation}
            onClick={handleAddLocation}
            aria-label="Ajouter ce lieu de pratique"
          >
            +
          </button>
          {isOtherCategory ? (
            <input
              className={`${fieldStyles.input} ${styles.compactInput} ${styles.categoryCustomInput}`}
              style={fieldAccentStyle}
              name="clubSetupLocationCategoryCustom"
              aria-label="Nom de la catégorie"
              {...noBrowserAddressAutofill}
              value={locationCategoryCustom}
              placeholder="Nom de la catégorie"
              onChange={(event) => setLocationCategoryCustom(event.target.value)}
            />
          ) : null}
        </div>
        {locations.length > 0 ? (
          <div className={styles.locationsBlock}>
            <div className={styles.locationsWrap}>
              {locations.map((location, index) => (
                <PracticeLocationChip
                  key={`${location.name}-${index}`}
                  location={location}
                  onRemove={() => onRemoveLocation(index)}
                />
              ))}
            </div>
            <p className={styles.locationsSummary}>
              {ClubSetupFormat.practiceLocationsSummary({
                locations,
                fallbackCity: city,
              })}
            </p>
          </div>
        ) : null}
      </SetupCard>
    </div>
  );
}
