﻿using Formulate.Core.Persistence;

namespace Formulate.Core.Folders
{
    /// <summary>
    /// The default implementation of <see cref="IFolderEntityPersistence"/>.
    /// </summary>
    internal sealed class FolderEntityPersistence : EntityPersistence<PersistedFolder>, IFolderEntityPersistence
    {
        /// <summary>
        /// Initializes a new instance of the <see cref="FolderEntityPersistence"/> class.
        /// </summary>
        /// <inheritdoc />
        public FolderEntityPersistence(IPersistenceUtilityFactory persistenceHelperFactory) : base(persistenceHelperFactory)
        {
        }
    }
}