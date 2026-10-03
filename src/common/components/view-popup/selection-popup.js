import React from 'react';
import { useLocalization } from '@fluent/react';
import cx from 'classnames';
import ViewPopup from './common/view-popup';
import CustomSections from '../common/custom-sections';

import { IconColor16 } from '../common/icons';

import IconHighlight from '../../../../res/icons/16/annotate-highlight.svg';
import IconUnderline from '../../../../res/icons/16/annotate-underline.svg';

function SelectionPopup(props) {
	const { l10n } = useLocalization();

	function handleColorPick(color) {
		let type = props.textSelectionAnnotationMode;
		props.onAddAnnotation({ ...props.params.annotation, type, color });
	}

	function handleAddToNote() {
		props.onAddToNote([props.params.annotation]);
	}

	return (
		<ViewPopup
			className={cx("selection-popup", { "zotflow-labeled-palette": props.annotationColors.some(color => color[3]) })}
			rect={props.params.rect}
			anchorPoint={props.params.anchorPoint}
			uniqueRef={{}}
			padding={20}
			preferTop={props.params.preferTop}
			preferLeft={props.params.preferLeft}
		>
			<div className="colors" data-tabstop={1}>
				{props.annotationColors.map((color, index) => (<button
					key={index}
					tabIndex={-1}
					className={cx("toolbar-button color-button", { "zotflow-labeled-color": !!color[3] })}
					title={color[2]}
						aria-label={color[2]}
					onClick={() => handleColorPick(color[1])}
				><IconColor16 color={color[1]}/>{color[3] && <span className="zotflow-palette-label">{color[3]}</span>}</button>))}
			</div>
			<div className="tool-toggle" data-tabstop={1}>
				<button
					tabIndex={-1}
					className={cx('highlight', { active: props.textSelectionAnnotationMode === 'highlight' })}
					title={l10n.getString('reader-highlight-text')}
					onClick={() => props.onChangeTextSelectionAnnotationMode('highlight')}
				><IconHighlight/></button>
				<button
					tabIndex={-1}
					className={cx('underline', { active: props.textSelectionAnnotationMode === 'underline' })}
					title={l10n.getString('reader-underline-text')}
					onClick={() => props.onChangeTextSelectionAnnotationMode('underline')}
				><IconUnderline/></button>
			</div>
			{props.enableAddToNote &&
				<button className="toolbar-button wide-button" data-tabstop={1} onClick={handleAddToNote}>
					{l10n.getString('reader-add-to-note')}
				</button>}
			<CustomSections type="TextSelectionPopup" annotation={props.params.annotation}/>
		</ViewPopup>
	);
}

export default SelectionPopup;
