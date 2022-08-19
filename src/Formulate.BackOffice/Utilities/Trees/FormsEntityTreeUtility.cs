﻿namespace Formulate.BackOffice.Utilities.Trees
{
    using Formulate.BackOffice.Persistence;
    using Formulate.BackOffice.Trees;
    using Formulate.Core.ConfiguredForms;
    using Formulate.Core.Persistence;
    using Microsoft.AspNetCore.Http;
    using System.Collections.Generic;
    using Umbraco.Cms.Core.Actions;
    using Umbraco.Cms.Core.Services;
    using Umbraco.Cms.Core.Trees;

    internal sealed class FormsEntityTreeUtility : EntityTreeUtility, IFormsEntityTreeUtility
    {
        public FormsEntityTreeUtility(ILocalizedTextService localizedTextService, IMenuItemCollectionFactory menuItemCollectionFactory, ITreeEntityRepository treeEntityRepository) : base(localizedTextService, menuItemCollectionFactory, treeEntityRepository)
        {
        }

        protected override MenuItemCollection GetMenuForEntity(IPersistedEntity entity, FormCollection queryStrings)
        {
            var menuItemCollection = _menuItemCollectionFactory.Create();

            if (entity is PersistedConfiguredForm)
            {
                menuItemCollection.AddDeleteDialogMenuItem(_localizedTextService);
            }
            else
            {
                menuItemCollection.DefaultMenuAlias = ActionNew.ActionAlias;

                menuItemCollection.AddCreateDialogMenuItem(_localizedTextService);
                menuItemCollection.AddDeleteDialogMenuItem(_localizedTextService);
                menuItemCollection.AddMoveDialogMenuItem(_localizedTextService);

                menuItemCollection.AddRefreshMenuItem(_localizedTextService);
            }

            return menuItemCollection;
        }

        protected override EntityTreeNodeMetaData GetNodeMetaData(IPersistedEntity entity)
        {
            if (entity.IsFolder())
            {
                return new EntityTreeNodeMetaData(Constants.Icons.Folders.Forms);
            }
            
            if (entity is PersistedConfiguredForm)
            {
                return new EntityTreeNodeMetaData(Constants.Icons.Entities.ConfiguredForm);
            }
            
            return new EntityTreeNodeMetaData(Constants.Icons.Entities.Form);
        }

        /// <inheritdoc />
        protected override IReadOnlyCollection<IPersistedEntity> GetRootEntities()
        {
            return _treeEntityRepository.GetRootItems(TreeRootTypes.Forms);
        }
    }
}