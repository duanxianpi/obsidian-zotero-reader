import { ANNOTATION_COLORS, EXTRA_INK_AND_TEXT_COLORS } from './defines';

// Configuration belongs to a Reader, never to the module's default constants.
export function copyProfileConfig(config) {
	if (!config?.profiles?.length) return null;
	const copy = JSON.parse(JSON.stringify(config));
	copy.profiles = copy.profiles.filter(profile => profile.palette?.length);
	if (!copy.profiles.length) return null;
	if (!copy.profiles.some(profile => profile.id === copy.activeProfileId)) {
		copy.activeProfileId = copy.profiles[0].id;
	}
	return copy;
}

export function profileColors(config, getString, includeExtra = false) {
	const profile = config?.profiles.find(profile => profile.id === config.activeProfileId);
	const entries = profile?.palette || ANNOTATION_COLORS.map(([, color]) => ({ color, label: '' }));
	const colors = entries.map(entry => {
		const standard = [...ANNOTATION_COLORS, ...EXTRA_INK_AND_TEXT_COLORS].find(([, color]) => color === entry.color);
		const label = entry.label || (standard ? getString(standard[0]) : entry.color);
		return [label, entry.color, `${label} (${entry.color})`, entry.label || ''];
	});
	if (includeExtra) {
		for (const [key, color] of EXTRA_INK_AND_TEXT_COLORS) {
			if (!colors.some(entry => entry[1] === color)) colors.push([getString(key), color, `${getString(key)} (${color})`, '']);
		}
	}
	return colors;
}

// Called only on creation, before history and delayed persistence capture it.
export function tagNewAnnotation(annotation, config) {
	if (!config?.autoTag || annotation.isExternal || annotation.readOnly) return;
	const profile = config.profiles.find(profile => profile.id === config.activeProfileId);
	const label = profile?.palette.find(entry => entry.color === annotation.color?.toLowerCase())?.label;
	if (label && !annotation.tags.some(tag => tag.name === label)) {
		annotation.tags = [...annotation.tags, { name: label }];
	}
}
