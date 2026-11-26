import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { ICity, ICountry, IState } from "country-state-city";
import type { CampaignGeography } from "./api";

type LocationDirectory = typeof import("country-state-city");
type SmallLocationDirectory = Pick<LocationDirectory, "Country" | "State">;
type CityDirectory = LocationDirectory["City"];
type RegionChoice = { country: ICountry; region: IState; path: string };
type CityChoice = { country: ICountry; region: IState | null; city: ICity; path: string };

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function matchesSearch(value: string, search: string): boolean {
  return value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
}

export function GeographyPicker({
  value,
  onChange,
}: {
  value: CampaignGeography;
  onChange: (value: CampaignGeography) => void;
}) {
  const [directory, setDirectory] = useState<SmallLocationDirectory | null>(null);
  const [cityDirectory, setCityDirectory] = useState<CityDirectory | null>(null);
  const [loadError, setLoadError] = useState("");
  const [cityLoadError, setCityLoadError] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [districtDrafts, setDistrictDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    Promise.all([
      import("country-state-city/lib/country"),
      import("country-state-city/lib/state"),
    ])
      .then(([country, state]) => {
        if (active) setDirectory({ Country: country.default, State: state.default });
      })
      .catch(() => {
        if (active) setLoadError("Location options could not be loaded. Please reload and try again.");
      });
    return () => {
      active = false;
    };
  }, []);

  const countries = useMemo(
    () => directory?.Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [directory],
  );
  const selectedCountrySet = useMemo(() => new Set(value.countries), [value.countries]);
  const selectedCountries = useMemo(
    () => countries.filter((country) => selectedCountrySet.has(country.name)),
    [countries, selectedCountrySet],
  );
  const regionOptions = useMemo<RegionChoice[]>(() => {
    if (!directory) return [];
    return selectedCountries.flatMap((country) =>
      directory.State.getStatesOfCountry(country.isoCode).map((region) => ({
        country,
        region,
        path: `${country.name} > ${region.name}`,
      })),
    );
  }, [directory, selectedCountries]);
  const needsCityData = useMemo(
    () => !!directory && (
      regionOptions.some((choice) => value.regions.includes(choice.path))
      || selectedCountries.some((country) => directory.State.getStatesOfCountry(country.isoCode).length === 0)
    ),
    [directory, regionOptions, selectedCountries, value.regions],
  );

  useEffect(() => {
    if (!needsCityData || cityDirectory || cityLoadError) return;
    let active = true;
    import("country-state-city/lib/city")
      .then((city) => {
        if (active) setCityDirectory(city.default);
      })
      .catch(() => {
        if (active) setCityLoadError("City options could not be loaded. Please reload and try again.");
      });
    return () => {
      active = false;
    };
  }, [cityDirectory, cityLoadError, needsCityData]);

  const cityOptions = useMemo<CityChoice[]>(() => {
    if (!directory || !cityDirectory) return [];
    const selectedRegionPaths = new Set(value.regions);
    const selectedRegions = regionOptions.filter((choice) => selectedRegionPaths.has(choice.path));
    const regionCities = selectedRegions.flatMap(({ country, region }) =>
      cityDirectory.getCitiesOfState(country.isoCode, region.isoCode).map((city) => ({
        country,
        region,
        city,
        path: `${country.name} > ${region.name} > ${city.name}`,
      })),
    );
    const countriesWithoutRegions = selectedCountries.filter(
      (country) => directory.State.getStatesOfCountry(country.isoCode).length === 0,
    );
    const countryCities = countriesWithoutRegions.flatMap((country) =>
      (cityDirectory.getCitiesOfCountry(country.isoCode) ?? []).map((city) => ({
        country,
        region: null,
        city,
        path: `${country.name} > ${city.name}`,
      })),
    );
    const uniqueCities = new Map<string, CityChoice>();
    for (const choice of [...regionCities, ...countryCities]) uniqueCities.set(choice.path, choice);
    return [...uniqueCities.values()].sort((a, b) => a.path.localeCompare(b.path));
  }, [cityDirectory, directory, regionOptions, selectedCountries, value.regions]);

  const visibleCountries = useMemo(() => {
    const selected = countries.filter((country) => selectedCountrySet.has(country.name));
    const matches = countries.filter(
      (country) => !selectedCountrySet.has(country.name) && matchesSearch(country.name, countrySearch),
    );
    return [...selected, ...matches.slice(0, 100)];
  }, [countries, countrySearch, selectedCountrySet]);
  const visibleRegions = useMemo(() => {
    const selected = regionOptions.filter((choice) => value.regions.includes(choice.path));
    const matches = regionOptions.filter(
      (choice) => !value.regions.includes(choice.path)
        && matchesSearch(`${choice.region.name} ${choice.country.name}`, regionSearch),
    );
    return [...selected, ...matches.slice(0, 100)];
  }, [regionOptions, regionSearch, value.regions]);
  const visibleCities = useMemo(() => {
    const selected = cityOptions.filter((choice) => value.cities.includes(choice.path));
    const matches = cityOptions.filter(
      (choice) => !value.cities.includes(choice.path)
        && matchesSearch(`${choice.city.name} ${choice.region?.name ?? ""} ${choice.country.name}`, citySearch),
    );
    return [...selected, ...matches.slice(0, 100)];
  }, [cityOptions, citySearch, value.cities]);

  function toggleCountry(country: ICountry, checked: boolean) {
    const prefix = `${country.name} > `;
    onChange({
      countries: checked
        ? unique([...value.countries, country.name])
        : value.countries.filter((name) => name !== country.name),
      regions: checked ? value.regions : value.regions.filter((path) => !path.startsWith(prefix)),
      cities: checked ? value.cities : value.cities.filter((path) => !path.startsWith(prefix)),
      districts: checked ? value.districts : value.districts.filter((path) => !path.startsWith(prefix)),
    });
  }

  function toggleRegion(choice: RegionChoice, checked: boolean) {
    const prefix = `${choice.path} > `;
    onChange({
      ...value,
      regions: checked
        ? unique([...value.regions, choice.path])
        : value.regions.filter((path) => path !== choice.path),
      cities: checked ? value.cities : value.cities.filter((path) => !path.startsWith(prefix)),
      districts: checked ? value.districts : value.districts.filter((path) => !path.startsWith(prefix)),
    });
  }

  function toggleCity(choice: CityChoice, checked: boolean) {
    const prefix = `${choice.path} > `;
    onChange({
      ...value,
      cities: checked
        ? unique([...value.cities, choice.path])
        : value.cities.filter((path) => path !== choice.path),
      districts: checked ? value.districts : value.districts.filter((path) => !path.startsWith(prefix)),
    });
  }

  function addDistrict(cityPath: string) {
    const name = (districtDrafts[cityPath] ?? "").trim();
    if (!name) return;
    const path = `${cityPath} > ${name}`;
    onChange({ ...value, districts: unique([...value.districts, path]) });
    setDistrictDrafts((drafts) => ({ ...drafts, [cityPath]: "" }));
  }

  return (
    <div className="geography-picker">
      <fieldset className="geography-block">
        <legend>Countries</legend>
        <label className="geography-search">
          Search countries
          <input
            type="search"
            value={countrySearch}
            onChange={(event) => setCountrySearch(event.target.value)}
            placeholder="Type a country name"
          />
        </label>
        {directory ? (
          <div className="geography-options">
            {visibleCountries.map((country) => (
              <label className="check-option geography-option" key={country.isoCode}>
                <input
                  type="checkbox"
                  checked={selectedCountrySet.has(country.name)}
                  onChange={(event) => toggleCountry(country, event.target.checked)}
                />
                <span><Check size={11} /></span>
                <span className="geography-flag">{country.flag}</span>
                {country.name}
              </label>
            ))}
            {!visibleCountries.length && <small>No countries match that search.</small>}
          </div>
        ) : (
          <small role={loadError ? "alert" : undefined}>
            {loadError || "Loading country options…"}
          </small>
        )}
      </fieldset>

      {!!selectedCountries.length && (
        <fieldset className="geography-block">
          <legend>Regions, states, provinces or districts</legend>
          <small>Choose one or more within the selected countries. City choices update from these selections.</small>
          <label className="geography-search">
            Search regions
            <input
              type="search"
              value={regionSearch}
              onChange={(event) => setRegionSearch(event.target.value)}
              placeholder="Type a region name"
            />
          </label>
          <div className="geography-options">
            {visibleRegions.map(({ country, region, path }) => (
              <label className="check-option geography-option" key={path}>
                <input
                  type="checkbox"
                  checked={value.regions.includes(path)}
                  onChange={(event) => toggleRegion({ country, region, path }, event.target.checked)}
                />
                <span><Check size={11} /></span>
                {region.name} <small>({country.name})</small>
              </label>
            ))}
            {!regionOptions.length && <small>No region data is available for the selected countries.</small>}
            {!!regionOptions.length && !visibleRegions.length && <small>No regions match that search.</small>}
          </div>
        </fieldset>
      )}

      {!!selectedCountries.length && (
        <fieldset className="geography-block">
          <legend>Cities</legend>
          <small>Select as many as needed. Countries and regions are included with each saved location.</small>
          {!!regionOptions.length && !value.regions.length && (
            <small>Select at least one region above to show its cities.</small>
          )}
          <label className="geography-search">
            Search cities
            <input
              type="search"
              value={citySearch}
              onChange={(event) => setCitySearch(event.target.value)}
              placeholder="Type a city name"
            />
          </label>
          <div className="geography-options">
            {visibleCities.map((choice) => (
              <label className="check-option geography-option" key={choice.path}>
                <input
                  type="checkbox"
                  checked={value.cities.includes(choice.path)}
                  onChange={(event) => toggleCity(choice, event.target.checked)}
                />
                <span><Check size={11} /></span>
                {choice.city.name}
                <small>({choice.region ? `${choice.region.name}, ` : ""}{choice.country.name})</small>
              </label>
            ))}
            {!!cityOptions.length && cityOptions.length > visibleCities.length && (
              <small>Search to narrow the list; showing up to 100 matching cities plus any selected cities.</small>
            )}
            {needsCityData && !cityDirectory && !cityLoadError && <small>Loading city options…</small>}
            {cityLoadError && <small role="alert">{cityLoadError}</small>}
            {!cityOptions.length && !!cityDirectory && !regionOptions.length && (
              <small>No city data is available for the selected countries.</small>
            )}
            {!cityOptions.length && !!cityDirectory && !!regionOptions.length && !!value.regions.length && (
              <small>No city data is available for the selected regions.</small>
            )}
          </div>
        </fieldset>
      )}

      {!!value.cities.length && (
        <fieldset className="geography-block">
          <legend>Districts and local areas</legend>
          <small>District naming varies by country. Add one or more local areas under each selected city.</small>
          {value.cities.map((cityPath) => {
            const districtPrefix = `${cityPath} > `;
            const cityDistricts = value.districts.filter((path) => path.startsWith(districtPrefix));
            const cityName = cityPath.split(" > ").slice(-1)[0];
            return (
              <div className="geography-district" key={cityPath}>
                <strong>{cityName}</strong>
                <div className="geography-add-row">
                  <input
                    value={districtDrafts[cityPath] ?? ""}
                    onChange={(event) => setDistrictDrafts((drafts) => ({
                      ...drafts,
                      [cityPath]: event.target.value,
                    }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addDistrict(cityPath);
                      }
                    }}
                    aria-label={`Add district or local area within ${cityName}`}
                    placeholder="Enter district or local area"
                  />
                  <button
                    className="button secondary"
                    type="button"
                    disabled={!(districtDrafts[cityPath] ?? "").trim()}
                    onClick={() => addDistrict(cityPath)}
                  >
                    Add
                  </button>
                </div>
                {cityDistricts.map((path) => (
                  <label className="check-option geography-option" key={path}>
                    <input
                      type="checkbox"
                      checked
                      onChange={() => onChange({
                        ...value,
                        districts: value.districts.filter((district) => district !== path),
                      })}
                    />
                    <span><Check size={11} /></span>
                    {path.slice(districtPrefix.length)}
                  </label>
                ))}
              </div>
            );
          })}
        </fieldset>
      )}

      <p className="form-hint">
        Selections are saved as readable location lists, not JSON. You can select multiple countries,
        regions, cities, and local areas.
      </p>
    </div>
  );
}
