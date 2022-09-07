﻿namespace Formulate.BackOffice.EditorModels.Forms
{
    // Namespaces.
    using System;
    using System.Runtime.Serialization;

    /// <summary>
    /// The data required by the back office for a form handler.
    /// </summary>
    [DataContract]
    public sealed class FormHandlerEditorModel : ItemEditorModel
    {
        /// <summary>
        /// The configuration for this handler.
        /// </summary>
        [DataMember(Name = "configuration")]
        public object Configuration { get; set; }

        /// <summary>
        /// The ID for the type of this handler.
        /// </summary>
        [DataMember(Name = "kindId")]
        public Guid KindId { get; set; }

        /// <summary>
        /// The back office directive that renders this handler.
        /// </summary>
        [DataMember(Name = "directive")]
        public string Directive { get; set; }

        /// <summary>
        /// Is this handler enabled?
        /// </summary>
        [DataMember(Name = "enabled")]
        public bool Enabled { get; set; }

        /// <summary>
        /// The icon representing the type for this handler.
        /// </summary>
        [DataMember(Name = "icon")]
        public string Icon { get; set; }
    }
}