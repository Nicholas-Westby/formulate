﻿using System;
using System.Collections.Generic;
using Formulate.BackOffice.Persistence;
using Formulate.Core.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Trees;
using Umbraco.Cms.Web.BackOffice.Trees;
using Umbraco.Extensions;

namespace Formulate.BackOffice.Trees
{
    /// <summary>
    /// A base tree controller class for handling Formulate entity trees.
    /// </summary>
    public abstract class FormulateTreeController : TreeController
    {
        /// <summary>
        /// The tree entity persistence.
        /// </summary>
        private readonly ITreeEntityPersistence _treeEntityPersistence;

        /// <summary>
        /// The menu item collection factory.
        /// </summary>
        private readonly IMenuItemCollectionFactory _menuItemCollectionFactory;

        /// <summary>
        /// Initializes a new instance of the <see cref="FormulateTreeController"/> class.
        /// </summary>
        /// <param name="treeEntityPersistence">The tree entity persistence.</param>
        /// <param name="menuItemCollectionFactory">The menu item collection factory.</param>
        /// <param name="localizedTextService">The localized text service.</param>
        /// <param name="umbracoApiControllerTypeCollection">The umbraco api controller type collection.</param>
        /// <param name="eventAggregator">The event aggregator.</param>
        protected FormulateTreeController(ITreeEntityPersistence treeEntityPersistence,
            IMenuItemCollectionFactory menuItemCollectionFactory, ILocalizedTextService localizedTextService,
            UmbracoApiControllerTypeCollection umbracoApiControllerTypeCollection, IEventAggregator eventAggregator) :
            base(localizedTextService, umbracoApiControllerTypeCollection, eventAggregator)
        {
            _treeEntityPersistence = treeEntityPersistence;
            _menuItemCollectionFactory = menuItemCollectionFactory;
        }

        /// <summary>
        /// Gets the entity type.
        /// </summary>
        protected abstract FormulateEntityTypes EntityType { get; }

        /// <summary>
        /// Gets the root node icon.
        /// </summary>
        protected abstract string RootNodeIcon { get; }

        /// <summary>
        /// Gets the folder node icon.
        /// </summary>
        protected abstract string FolderNodeIcon { get; }

        /// <summary>
        /// Gets the item node icon.
        /// </summary>
        protected abstract string ItemNodeIcon { get; }

        /// <summary>
        /// Gets the item node action.
        /// </summary>
        protected abstract string ItemNodeAction { get; }

        /// <inheritdoc />
        protected override ActionResult<TreeNode> CreateRootNode(FormCollection queryStrings)
        {
            var node = base.CreateRootNode(queryStrings);
            node.Value.Icon = RootNodeIcon;

            return node;
        }

        /// <inheritdoc />
        protected override ActionResult<TreeNodeCollection> GetTreeNodes(string id, FormCollection queryStrings)
        {
            var nodes = new TreeNodeCollection();
            var entities = GetEntities(id);

            foreach (var entity in entities)
            {
                var hasChildren = _treeEntityPersistence.HasChildren(entity.Id);
                var icon = GetNodeIcon(entity);
                var routePath = $"/formulate/formulate/{GetNodeAction(entity)}/{entity.Id:N}";
                var node = CreateTreeNode(entity.Id.ToString(), id, queryStrings, entity.Name, icon, hasChildren, routePath);

                nodes.Add(node);
            }

            return nodes;
        }
        
        /// <inheritdoc />
        protected override ActionResult<MenuItemCollection> GetMenuForNode(string id, FormCollection queryStrings)
        {
            return _menuItemCollectionFactory.Create();
        }

        /// <summary>
        /// Gets the action used when a user clicks on this node in the tree.
        /// </summary>
        /// <param name="entity">The entity.</param>
        /// <returns>A <see cref="string"/>.</returns>
        protected virtual string GetNodeAction(IPersistedEntity entity)
        {
            return entity.IsFolder() ? "editFolder" : ItemNodeAction;
        }

        /// <summary>
        /// Gets the icon used for the current entity node.
        /// </summary>
        /// <param name="entity"></param>
        /// <returns></returns>
        protected virtual string GetNodeIcon(IPersistedEntity entity)
        {
            return entity.IsFolder() ? FolderNodeIcon : ItemNodeIcon;
        }

        /// <summary>
        /// Gets the entities used to populate the tree.
        /// </summary>
        /// <param name="id">The current id.</param>
        /// <returns>A read only collection of <see cref="IPersistedEntity"/>.</returns>
        private IReadOnlyCollection<IPersistedEntity> GetEntities(string id)
        {
            if (id.Equals(Constants.System.Root.ToInvariantString()))
            {
                return _treeEntityPersistence.GetRootItems(EntityType);
            }

            if (Guid.TryParse(id, out var parentId))
            {
                return _treeEntityPersistence.GetChildren(parentId);
            }

            return Array.Empty<IPersistedEntity>();
        }
    }
}