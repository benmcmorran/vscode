/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IChannel } from 'vs/base/parts/ipc/common/ipc';
import { IProfileAwareExtensionManagementService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { ExtensionManagementChannelClient } from 'vs/platform/extensionManagement/common/extensionManagementIpc';
import { URI } from 'vs/base/common/uri';
import { IGalleryExtension, ILocalExtension, InstallOptions, InstallVSIXOptions, UninstallOptions } from 'vs/platform/extensionManagement/common/extensionManagement';
import { ExtensionIdentifier, ExtensionType } from 'vs/platform/extensions/common/extensions';
import { Emitter } from 'vs/base/common/event';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { delta } from 'vs/base/common/arrays';
import { compare } from 'vs/base/common/strings';

export class NativeProfileAwareExtensionManagementService extends ExtensionManagementChannelClient implements IProfileAwareExtensionManagementService {

	private readonly _onDidChangeProfileExtensions = this._register(new Emitter<{ readonly added: ILocalExtension[]; readonly removed: ILocalExtension[] }>());
	readonly onDidChangeProfileExtensions = this._onDidChangeProfileExtensions.event;

	constructor(channel: IChannel, private extensionsProfileResource: URI | undefined,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
	) {
		super(channel);
	}

	override install(vsix: URI, options?: InstallVSIXOptions): Promise<ILocalExtension> {
		return super.install(vsix, { ...options, profileLocation: this.extensionsProfileResource });
	}

	override installFromGallery(extension: IGalleryExtension, installOptions?: InstallOptions): Promise<ILocalExtension> {
		return super.installFromGallery(extension, { ...installOptions, profileLocation: this.extensionsProfileResource });
	}

	override uninstall(extension: ILocalExtension, options?: UninstallOptions): Promise<void> {
		return super.uninstall(extension, { ...options, profileLocation: this.extensionsProfileResource });
	}

	override getInstalled(type: ExtensionType | null = null): Promise<ILocalExtension[]> {
		return super.getInstalled(type, this.extensionsProfileResource);
	}

	async switchExtensionsProfile(extensionsProfileResource: URI | undefined): Promise<void> {
		if (this.uriIdentityService.extUri.isEqual(extensionsProfileResource, this.extensionsProfileResource)) {
			return;
		}
		const oldExtensions = await this.getInstalled(ExtensionType.User);
		this.extensionsProfileResource = extensionsProfileResource;
		const newExtensions = await this.getInstalled(ExtensionType.User);
		const { added, removed } = delta(oldExtensions, newExtensions, (a, b) => compare(ExtensionIdentifier.toKey(a.identifier.id), ExtensionIdentifier.toKey(b.identifier.id)));
		if (added.length || removed.length) {
			this._onDidChangeProfileExtensions.fire({ added, removed });
		}
	}

}
